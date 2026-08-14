import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MatchActivationCondition,
  MatchSlot,
  MatchStatus,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import {
  BulkScheduleDto,
  CreateManualMatchDto,
  PutMatchScoresDto,
  UpdateMatchDto,
} from './dto/match.dto';

const matchResultSelect = {
  id: true,
  teamAId: true,
  teamBId: true,
  scoreA: true,
  scoreB: true,
  status: true,
  isActive: true,
  activationCondition: true,
  bracketType: true,
  bestOf: true,
  winnerTeamId: true,
  playedAt: true,
  nextMatchId: true,
  nextMatchSlot: true,
  loserNextMatchId: true,
  loserNextMatchSlot: true,
  round: { select: { id: true, format: true, tournamentId: true } },
  _count: { select: { scores: true } },
} satisfies Prisma.MatchSelect;

type ResultMatch = Prisma.MatchGetPayload<{ select: typeof matchResultSelect }>;
type Tx = Prisma.TransactionClient;

const publicTeamSelect = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
} as const;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: TournamentEventsService,
  ) {}

  async findOne(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        scores: { orderBy: { setNumber: 'asc' } },
        teamA: { select: publicTeamSelect },
        teamB: { select: publicTeamSelect },
        winner: { select: publicTeamSelect },
        round: {
          select: {
            id: true,
            name: true,
            format: true,
            tournament: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async update(matchId: string, dto: UpdateMatchDto) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.findResultMatch(tx, matchId);
      this.assertActive(match);
      const changesScore = dto.scoreA !== undefined || dto.scoreB !== undefined;
      if (changesScore && match._count.scores > 0) {
        throw new ConflictException(
          'Match has per-game scores; use PUT /matches/:id/scores',
        );
      }

      const scoreA = dto.scoreA ?? match.scoreA;
      const scoreB = dto.scoreB ?? match.scoreB;
      const status = dto.status ?? match.status;
      const winnerTeamId = this.validateResult(match, scoreA, scoreB, status);

      if (match.status === MatchStatus.COMPLETED) {
        await this.rollbackPreviousAdvancement(tx, match, winnerTeamId, status);
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          scoreA: dto.scoreA,
          scoreB: dto.scoreB,
          scheduledAt:
            dto.scheduledAt === undefined
              ? undefined
              : dto.scheduledAt === null
                ? null
                : new Date(dto.scheduledAt),
          discordLink: dto.discordLink,
          status: dto.status,
          winnerTeamId,
          playedAt:
            status === MatchStatus.COMPLETED
              ? (match.playedAt ?? new Date())
              : null,
        },
      });

      if (status === MatchStatus.COMPLETED) {
        await this.advanceResult(tx, match, winnerTeamId!);
      }
      return updated;
    });
    await this.publishMatchEvents(
      matchId,
      updated,
      dto.scheduledAt !== undefined,
    );
    return updated;
  }

  async putScores(matchId: string, dto: PutMatchScoresDto) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.findResultMatch(tx, matchId);
      this.assertActive(match);
      const calculated = this.calculateSeries(dto, match.bestOf);
      const status = calculated.completed
        ? MatchStatus.COMPLETED
        : MatchStatus.ONGOING;
      const winnerTeamId = this.validateResult(
        match,
        calculated.scoreA,
        calculated.scoreB,
        status,
      );

      if (match.status === MatchStatus.COMPLETED) {
        await this.rollbackPreviousAdvancement(tx, match, winnerTeamId, status);
      }

      await tx.matchScore.deleteMany({ where: { matchId } });
      await tx.matchScore.createMany({
        data: dto.scores.map((score) => ({ matchId, ...score })),
      });
      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          scoreA: calculated.scoreA,
          scoreB: calculated.scoreB,
          status,
          winnerTeamId,
          playedAt:
            status === MatchStatus.COMPLETED
              ? (match.playedAt ?? new Date())
              : null,
        },
        include: { scores: { orderBy: { setNumber: 'asc' } } },
      });

      if (status === MatchStatus.COMPLETED) {
        await this.advanceResult(tx, match, winnerTeamId!);
      }
      return updated;
    });
    await this.publishMatchEvents(matchId, updated, false);
    return updated;
  }

  async bulkSchedule(dto: BulkScheduleDto) {
    const ids = dto.matches.map((item) => item.matchId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Match IDs must be unique');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const matches = await tx.match.findMany({
        where: { id: { in: ids } },
        select: { id: true, round: { select: { tournamentId: true } } },
      });
      if (matches.length !== ids.length) {
        throw new NotFoundException('One or more matches were not found');
      }
      if (
        new Set(matches.map((match) => match.round.tournamentId)).size !== 1
      ) {
        throw new BadRequestException(
          'All matches must belong to the same tournament',
        );
      }
      for (const item of dto.matches) {
        await tx.match.update({
          where: { id: item.matchId },
          data: {
            scheduledAt:
              item.scheduledAt === null ? null : new Date(item.scheduledAt),
          },
        });
      }
      return {
        tournamentId: matches[0].round.tournamentId,
        updatedCount: ids.length,
        matchIds: ids,
      };
    });
    const { tournamentId, ...payload } = result;
    this.events?.publish({
      tournamentId,
      event: 'scheduleUpdated',
      payload,
    });
    return payload;
  }

  createManual(roundId: string, dto: CreateManualMatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true, bestOf: true },
      });
      if (!round) throw new NotFoundException('Round not found');
      if (dto.teamAId === dto.teamBId) {
        throw new BadRequestException('A team cannot play itself');
      }
      const teamIds = [dto.teamAId, dto.teamBId].filter(
        (id): id is string => id !== undefined,
      );
      const teams = await tx.team.findMany({
        where: { id: { in: teamIds }, tournamentId: round.tournamentId },
        select: { id: true },
      });
      if (teams.length !== new Set(teamIds).size) {
        throw new BadRequestException(
          'Every team must belong to the round tournament',
        );
      }
      if (dto.groupId) {
        const group = await tx.group.findFirst({
          where: { id: dto.groupId, roundId },
          select: { id: true },
        });
        if (!group) throw new BadRequestException('Group must belong to round');
      }
      const bestOf = dto.bestOf ?? round.bestOf;
      this.validateBestOf(bestOf);
      return tx.match.create({
        data: {
          roundId,
          groupId: dto.groupId,
          teamAId: dto.teamAId,
          teamBId: dto.teamBId,
          bestOf,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          discordLink: dto.discordLink,
        },
      });
    });
  }

  private async findResultMatch(tx: Tx, matchId: string) {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: matchResultSelect,
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  private async publishMatchEvents(
    matchId: string,
    payload: unknown,
    scheduleChanged: boolean,
  ) {
    if (!this.events) return;
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { round: { select: { tournamentId: true } } },
    });
    if (!match) return;
    this.events.publish({
      tournamentId: match.round.tournamentId,
      event: 'matchUpdated',
      payload,
    });
    this.events.publish({
      tournamentId: match.round.tournamentId,
      event: 'standingsUpdated',
      payload: { matchId },
    });
    if (scheduleChanged) {
      this.events.publish({
        tournamentId: match.round.tournamentId,
        event: 'scheduleUpdated',
        payload: { matchId },
      });
    }
  }

  private validateResult(
    match: ResultMatch,
    scoreA: number,
    scoreB: number,
    status: MatchStatus,
  ): string | null {
    this.validateBestOf(match.bestOf);
    const winsRequired = Math.floor(match.bestOf / 2) + 1;
    if (scoreA > winsRequired || scoreB > winsRequired) {
      throw new BadRequestException(
        'Score exceeds the wins required by bestOf',
      );
    }
    if (scoreA + scoreB > match.bestOf) {
      throw new BadRequestException('Score exceeds the maximum game count');
    }
    if (status !== MatchStatus.COMPLETED) {
      if (scoreA === winsRequired || scoreB === winsRequired) {
        throw new BadRequestException('A clinched series must be COMPLETED');
      }
      return null;
    }
    if (!match.teamAId || !match.teamBId) {
      throw new BadRequestException('Both match slots must be populated');
    }
    if ((scoreA === winsRequired) === (scoreB === winsRequired)) {
      throw new BadRequestException(
        'Completed match must have one valid winner',
      );
    }
    return scoreA === winsRequired ? match.teamAId : match.teamBId;
  }

  private assertActive(match: ResultMatch) {
    if (match.isActive === false) {
      throw new ConflictException('Match is not active');
    }
  }

  private calculateSeries(dto: PutMatchScoresDto, bestOf: number) {
    this.validateBestOf(bestOf);
    if (dto.scores.length > bestOf) {
      throw new BadRequestException('Too many games for match bestOf');
    }
    const sorted = [...dto.scores].sort((a, b) => a.setNumber - b.setNumber);
    if (
      new Set(sorted.map((score) => score.setNumber)).size !== sorted.length
    ) {
      throw new BadRequestException('setNumber must be unique');
    }
    if (sorted.some((score, index) => score.setNumber !== index + 1)) {
      throw new BadRequestException('setNumber must be consecutive from 1');
    }
    const winsRequired = Math.floor(bestOf / 2) + 1;
    let scoreA = 0;
    let scoreB = 0;
    sorted.forEach((game, index) => {
      if (game.teamAScore === game.teamBScore) {
        throw new BadRequestException('Individual games cannot end in a draw');
      }
      if (scoreA === winsRequired || scoreB === winsRequired) {
        throw new BadRequestException(
          `Game ${index + 1} occurs after the series was already won`,
        );
      }
      if (game.teamAScore > game.teamBScore) scoreA++;
      else scoreB++;
    });
    return {
      scoreA,
      scoreB,
      completed: scoreA === winsRequired || scoreB === winsRequired,
    };
  }

  private validateBestOf(bestOf: number) {
    if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf % 2 === 0) {
      throw new BadRequestException('bestOf must be a positive odd number');
    }
  }

  private async rollbackPreviousAdvancement(
    tx: Tx,
    match: ResultMatch,
    newWinnerTeamId: string | null,
    newStatus: MatchStatus,
  ) {
    if (
      newStatus === MatchStatus.COMPLETED &&
      newWinnerTeamId === match.winnerTeamId
    ) {
      return;
    }
    const oldWinner = match.winnerTeamId;
    const oldLoser =
      oldWinner === match.teamAId ? match.teamBId : match.teamAId;
    if (await this.rollbackConditionalReset(tx, match)) {
      await this.rollbackChampion(tx, match, oldWinner);
      return;
    }
    const routes = [
      { id: match.nextMatchId, slot: match.nextMatchSlot, teamId: oldWinner },
      {
        id: match.loserNextMatchId,
        slot: match.loserNextMatchSlot,
        teamId: oldLoser,
      },
    ].filter(
      (route): route is { id: string; slot: MatchSlot; teamId: string } =>
        Boolean(route.id && route.slot && route.teamId),
    );
    const downstream = await Promise.all(
      [...new Set(routes.map((route) => route.id))].map((id) =>
        tx.match.findUnique({
          where: { id },
          select: { id: true, status: true, teamAId: true, teamBId: true },
        }),
      ),
    );
    if (downstream.some((item) => item?.status === MatchStatus.COMPLETED)) {
      throw new ConflictException(
        'Downstream match is completed; reset it before changing this result',
      );
    }
    for (const route of routes) {
      const target = downstream.find((item) => item?.id === route.id)!;
      const field = route.slot === MatchSlot.A ? 'teamAId' : 'teamBId';
      if (target[field] !== route.teamId) {
        throw new ConflictException(
          'Downstream slot no longer contains the previously advanced team',
        );
      }
      await tx.match.update({
        where: { id: route.id },
        data: { [field]: null },
      });
      target[field] = null;
    }
    await this.rollbackChampion(tx, match, oldWinner);
  }

  private async advanceResult(
    tx: Tx,
    match: ResultMatch,
    winnerTeamId: string,
  ) {
    const loserTeamId =
      winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    if (
      await this.processConditionalReset(tx, match, winnerTeamId, loserTeamId)
    ) {
      return;
    }
    await this.placeTeam(
      tx,
      match.nextMatchId,
      match.nextMatchSlot,
      winnerTeamId,
    );
    await this.placeTeam(
      tx,
      match.loserNextMatchId,
      match.loserNextMatchSlot,
      loserTeamId,
    );
    if (this.isDecisiveDoubleElimFinal(match)) {
      await this.finalizeChampion(tx, match, winnerTeamId);
    }
  }

  private async processConditionalReset(
    tx: Tx,
    match: ResultMatch,
    winnerTeamId: string,
    loserTeamId: string | null,
  ): Promise<boolean> {
    if (!match.nextMatchId || match.nextMatchId !== match.loserNextMatchId) {
      return false;
    }
    const reset = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: {
        id: true,
        teamAId: true,
        teamBId: true,
        status: true,
        isActive: true,
        activationCondition: true,
      },
    });
    if (
      !reset ||
      reset.activationCondition !==
        MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL
    ) {
      return false;
    }
    if (!loserTeamId) {
      throw new ConflictException('Grand Final loser is missing');
    }

    // The generator always places the Winner Bracket champion in Grand Final
    // slot A and the Loser Bracket champion in slot B.
    if (winnerTeamId !== match.teamBId) {
      await this.finalizeChampion(tx, match, winnerTeamId);
      return true;
    }

    if (reset.status === MatchStatus.COMPLETED) {
      if (
        reset.isActive &&
        reset.teamAId === winnerTeamId &&
        reset.teamBId === loserTeamId
      ) {
        return true;
      }
      throw new ConflictException('Grand Final Reset is already completed');
    }
    if (
      (reset.teamAId !== null && reset.teamAId !== winnerTeamId) ||
      (reset.teamBId !== null && reset.teamBId !== loserTeamId)
    ) {
      throw new ConflictException(
        'Grand Final Reset slots are already occupied',
      );
    }
    if (
      !reset.isActive ||
      reset.teamAId !== winnerTeamId ||
      reset.teamBId !== loserTeamId
    ) {
      await tx.match.update({
        where: { id: reset.id },
        data: {
          isActive: true,
          teamAId: winnerTeamId,
          teamBId: loserTeamId,
        },
      });
    }
    return true;
  }

  private async rollbackConditionalReset(
    tx: Tx,
    match: ResultMatch,
  ): Promise<boolean> {
    if (!match.nextMatchId || match.nextMatchId !== match.loserNextMatchId) {
      return false;
    }
    const reset = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: {
        id: true,
        status: true,
        scoreA: true,
        scoreB: true,
        winnerTeamId: true,
        playedAt: true,
        activationCondition: true,
        _count: { select: { scores: true } },
      },
    });
    if (
      !reset ||
      reset.activationCondition !==
        MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL
    ) {
      return false;
    }
    if (
      reset.status !== MatchStatus.PENDING ||
      reset.scoreA !== 0 ||
      reset.scoreB !== 0 ||
      reset.winnerTeamId !== null ||
      reset.playedAt !== null ||
      reset._count.scores > 0
    ) {
      throw new ConflictException(
        'Grand Final Reset has started; reset it before changing the Grand Final',
      );
    }
    await tx.match.update({
      where: { id: reset.id },
      data: { isActive: false, teamAId: null, teamBId: null },
    });
    return true;
  }

  private isDecisiveDoubleElimFinal(match: ResultMatch): boolean {
    return (
      match.round?.format === RoundFormat.DOUBLE_ELIM &&
      match.bracketType === null &&
      (match.activationCondition !== null ||
        (!match.nextMatchId && !match.loserNextMatchId))
    );
  }

  private async finalizeChampion(
    tx: Tx,
    match: ResultMatch,
    winnerTeamId: string,
  ) {
    await tx.team.updateMany({
      where: {
        tournamentId: match.round.tournamentId,
        finalRank: 1,
        id: { not: winnerTeamId },
      },
      data: { finalRank: null },
    });
    await tx.team.update({
      where: { id: winnerTeamId },
      data: { finalRank: 1 },
    });
    await tx.round.update({
      where: { id: match.round.id },
      data: { status: RoundStatus.COMPLETED },
    });
    await tx.tournament.update({
      where: { id: match.round.tournamentId },
      data: { status: TournamentStatus.COMPLETED },
    });
  }

  private async rollbackChampion(
    tx: Tx,
    match: ResultMatch,
    oldWinnerTeamId: string | null,
  ) {
    if (!oldWinnerTeamId || !this.isDecisiveDoubleElimFinal(match)) return;
    const cleared = await tx.team.updateMany({
      where: { id: oldWinnerTeamId, finalRank: 1 },
      data: { finalRank: null },
    });
    if (cleared.count > 0) {
      await tx.round.update({
        where: { id: match.round.id },
        data: { status: RoundStatus.ONGOING },
      });
      await tx.tournament.update({
        where: { id: match.round.tournamentId },
        data: { status: TournamentStatus.ONGOING },
      });
    }
  }

  private async placeTeam(
    tx: Tx,
    targetId: string | null,
    slot: MatchSlot | null,
    teamId: string | null,
  ) {
    if (!targetId && !slot) return;
    if (!targetId || !slot || !teamId) {
      throw new ConflictException('Bracket progression link is incomplete');
    }
    const target = await tx.match.findUnique({
      where: { id: targetId },
      select: { teamAId: true, teamBId: true },
    });
    if (!target) throw new ConflictException('Downstream match not found');
    const field = slot === MatchSlot.A ? 'teamAId' : 'teamBId';
    if (target[field] !== null && target[field] !== teamId) {
      throw new ConflictException(
        'Downstream bracket slot is already occupied',
      );
    }
    await tx.match.update({
      where: { id: targetId },
      data: { [field]: teamId },
    });
  }
}
