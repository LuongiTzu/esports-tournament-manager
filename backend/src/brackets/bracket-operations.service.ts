import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MatchStatus,
  Prisma,
  RegistrationStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BracketsService } from './brackets.service';
import { UpdateSeedsDto } from './dto/bracket-operations.dto';
import { MatchDraft } from './types/bracket-generator';
import { StandingsService } from './standings.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';

@Injectable()
export class BracketOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    private readonly standings: StandingsService,
    @Optional() private readonly events?: TournamentEventsService,
  ) {}

  async generate(roundId: string, force = false) {
    const result = await this.prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: {
          id: true,
          tournamentId: true,
          format: true,
          settings: true,
          bestOf: true,
          _count: { select: { groups: true } },
          matches: {
            select: {
              id: true,
              status: true,
              scoreA: true,
              scoreB: true,
              winnerTeamId: true,
              playedAt: true,
              _count: { select: { scores: true } },
            },
          },
        },
      });
      if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');

      if (round.matches.length || round._count.groups > 0) {
        if (!force)
          throw new ConflictException('Round already has generated matches');
        const protectedData = round.matches.some(
          (match) =>
            match.status !== MatchStatus.PENDING ||
            match.scoreA !== 0 ||
            match.scoreB !== 0 ||
            match.winnerTeamId !== null ||
            match.playedAt !== null ||
            match._count.scores > 0,
        );
        if (protectedData) {
          throw new ConflictException(
            'Cannot force regenerate: existing matches contain scores or progress',
          );
        }
        await tx.match.deleteMany({ where: { roundId } });
        await tx.group.deleteMany({ where: { roundId } });
      }

      const teams = await tx.team.findMany({
        where: {
          tournamentId: round.tournamentId,
          status: RegistrationStatus.APPROVED,
        },
        select: { id: true, name: true, seed: true, registeredAt: true },
      });
      validateTeamCount(round.format, teams.length, round.settings);
      const drafts = await this.brackets.generate({
        format: round.format,
        teams,
        settings: asRecord(round.settings),
        bestOf: round.bestOf,
      });
      const persisted = await persistDrafts(tx, roundId, teams, drafts);
      return {
        tournamentId: round.tournamentId,
        roundId,
        format: round.format,
        approvedTeamCount: teams.length,
        matchCount: persisted.length,
        force,
        matches: persisted,
      };
    });
    const { tournamentId, ...payload } = result;
    this.events?.publish({
      tournamentId,
      event: 'bracketGenerated',
      payload,
    });
    return payload;
  }

  async updateSeeds(roundId: string, dto: UpdateSeedsDto) {
    const seeds = dto.seeds.map((item) => item.seed);
    const teamIds = dto.seeds.map((item) => item.teamId);
    if (new Set(seeds).size !== seeds.length) {
      throw new BadRequestException('Seed values must be unique');
    }
    if (new Set(teamIds).size !== teamIds.length) {
      throw new BadRequestException('Teams must not be duplicated');
    }
    return this.prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: { tournamentId: true },
      });
      if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
      const eligible = await tx.team.findMany({
        where: {
          tournamentId: round.tournamentId,
          status: RegistrationStatus.APPROVED,
        },
        select: { id: true, seed: true },
      });
      const eligibleIds = new Set(eligible.map((team) => team.id));
      if (teamIds.some((teamId) => !eligibleIds.has(teamId))) {
        throw new BadRequestException(
          'Every seeded team must be approved and belong to the tournament',
        );
      }
      const requestedIds = new Set(teamIds);
      const occupiedSeeds = new Set(
        eligible
          .filter((team) => !requestedIds.has(team.id) && team.seed !== null)
          .map((team) => team.seed),
      );
      if (seeds.some((seed) => occupiedSeeds.has(seed))) {
        throw new BadRequestException(
          'Seed value is already assigned to another approved team',
        );
      }
      for (const assignment of dto.seeds) {
        await tx.team.update({
          where: { id: assignment.teamId },
          data: { seed: assignment.seed },
        });
      }
      return { roundId, seeds: dto.seeds };
    });
  }

  async advance(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        tournamentId: true,
        orderIndex: true,
        format: true,
        settings: true,
        matches: { select: { status: true, groupId: true } },
      },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    if (
      !round.matches.length ||
      round.matches.some((m) => m.status !== MatchStatus.COMPLETED)
    ) {
      throw new BadRequestException('Current round is not complete');
    }
    const nextRound = await this.prisma.round.findFirst({
      where: {
        tournamentId: round.tournamentId,
        orderIndex: { gt: round.orderIndex },
      },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, format: true },
    });
    if (!nextRound) throw new BadRequestException('No next round exists');
    const settings = asRecord(round.settings) ?? {};
    const configuredAdvanceCount = Number(settings.advanceCount ?? 0);
    if (
      !Number.isInteger(configuredAdvanceCount) ||
      configuredAdvanceCount < 1
    ) {
      throw new BadRequestException(
        'Round format does not define advanceCount',
      );
    }
    const result = await this.standings.forTournament(round.tournamentId, [
      { id: round.id, format: round.format, settings: round.settings },
    ]);

    if (round.format === RoundFormat.GROUP_STAGE) {
      const numGroups = Number(settings.numGroups);
      const teamsPerGroup = Number(settings.teamsPerGroup);
      if (
        !Number.isInteger(numGroups) ||
        numGroups < 1 ||
        !Number.isInteger(teamsPerGroup) ||
        teamsPerGroup < 2
      ) {
        throw new BadRequestException('Invalid GROUP_STAGE settings');
      }
      if (configuredAdvanceCount > teamsPerGroup) {
        throw new BadRequestException(
          'advanceCount cannot exceed teamsPerGroup',
        );
      }

      const groups = result.rounds[0].standings as Array<{
        groupId: string;
        name: string;
        orderIndex: number;
        standings: Array<{ teamId?: string; id?: string }>;
      }>;
      if (
        groups.length !== numGroups ||
        groups.some((group) => group.standings.length !== teamsPerGroup)
      ) {
        throw new BadRequestException(
          'Persisted groups do not match GROUP_STAGE settings',
        );
      }

      const matchesPerGroup =
        (teamsPerGroup * (teamsPerGroup - 1)) / 2 *
        (settings.doubleRound === true ? 2 : 1);
      if (
        groups.some(
          (group) =>
            round.matches.filter((match) => match.groupId === group.groupId)
              .length !== matchesPerGroup,
        )
      ) {
        throw new BadRequestException('Current round is not complete');
      }

      const qualifiedGroups = groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        orderIndex: group.orderIndex,
        teamIds: group.standings
          .slice(0, configuredAdvanceCount)
          .map((row) => row.teamId ?? row.id!),
      }));
      const teamIds = qualifiedGroups.flatMap((group) => group.teamIds);
      return {
        roundId,
        nextRound,
        advanceCount: teamIds.length,
        advanceCountPerGroup: configuredAdvanceCount,
        groups: qualifiedGroups,
        teamIds,
        prepared: true,
        persisted: false,
        note: 'Schema has no RoundTeam relation; advancement is prepared for next-round generation.',
      };
    }

    const standings = result.rounds[0].standings as Array<{
      teamId?: string;
      id?: string;
    }>;
    const teamIds = standings
      .slice(0, configuredAdvanceCount)
      .map((row) => row.teamId ?? row.id!);
    return {
      roundId,
      nextRound,
      advanceCount: configuredAdvanceCount,
      teamIds,
      prepared: true,
      persisted: false,
      note: 'Schema has no RoundTeam relation; advancement is prepared for next-round generation.',
    };
  }

  async remove(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    await this.prisma.round.delete({ where: { id: roundId } });
    return { message: 'Đã xóa vòng đấu thành công', roundId };
  }

  async getBracket(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        groups: {
          orderBy: { orderIndex: 'asc' },
          include: { teamAssignments: { include: { team: true } } },
        },
        matches: {
          orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
          include: { teamA: true, teamB: true, winner: true },
        },
      },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    return {
      round: {
        id: round.id,
        name: round.name,
        format: round.format,
        status: round.status,
        bestOf: round.bestOf,
        settings: round.settings,
      },
      groups: round.groups.map((group) => ({
        id: group.id,
        name: group.name,
        orderIndex: group.orderIndex,
        teams: group.teamAssignments.map((assignment) => assignment.team),
      })),
      matches: round.matches.map((match) => ({
        id: match.id,
        bracketRound: match.bracketRound,
        bracketType: match.bracketType,
        matchNumber: match.matchNumber,
        status: match.status,
        isBye: match.isBye,
        bestOf: match.bestOf,
        slots: { A: match.teamA, B: match.teamB },
        score: { A: match.scoreA, B: match.scoreB },
        winner: match.winner,
        nextMatch: { id: match.nextMatchId, slot: match.nextMatchSlot },
        loserNextMatch: {
          id: match.loserNextMatchId,
          slot: match.loserNextMatchSlot,
        },
      })),
    };
  }
}

function validateTeamCount(format: RoundFormat, count: number, raw: unknown) {
  const minimum = format === RoundFormat.DOUBLE_ELIM ? 4 : 2;
  if (count < minimum) {
    throw new BadRequestException(
      `${format} requires at least ${minimum} approved teams`,
    );
  }
  const settings = asRecord(raw);
  if (format === RoundFormat.GROUP_STAGE) {
    const expected =
      Number(settings?.numGroups) * Number(settings?.teamsPerGroup);
    if (count !== expected) {
      throw new BadRequestException(
        `GROUP_STAGE requires exactly ${expected} approved teams`,
      );
    }
  }
  if (count > 256)
    throw new BadRequestException('A round supports at most 256 teams');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

async function persistDrafts(
  tx: Prisma.TransactionClient,
  roundId: string,
  teams: Array<{ id: string }>,
  drafts: MatchDraft[],
) {
  const active = drafts.filter((draft) => !draft.activationCondition);
  const groupIds = new Map<string, string>();
  for (const group of uniqueGroups(active)) {
    const record = await tx.group.create({
      data: { roundId, name: group.name, orderIndex: group.orderIndex },
    });
    groupIds.set(group.key, record.id);
    const teamIds = new Set(
      active
        .filter((draft) => draft.group?.key === group.key)
        .flatMap((draft) => [draft.teamA.teamId, draft.teamB.teamId])
        .filter((id): id is string => id !== null),
    );
    await tx.groupTeam.createMany({
      data: teams
        .filter((team) => teamIds.has(team.id))
        .map((team) => ({ groupId: record.id, teamId: team.id })),
      skipDuplicates: true,
    });
  }
  const ids = new Map<string, string>();
  const rows: Array<Prisma.MatchGetPayload<object> & { draftKey: string }> = [];
  for (const draft of active) {
    const row = await tx.match.create({
      data: {
        roundId,
        groupId: draft.group ? groupIds.get(draft.group.key) : undefined,
        teamAId: draft.teamA.teamId,
        teamBId: draft.teamB.teamId,
        bracketRound: draft.bracketRound,
        bracketType: draft.bracketType,
        matchNumber: draft.matchNumber,
        isBye: draft.isBye,
        bestOf: draft.bestOf,
        status: draft.isBye ? MatchStatus.COMPLETED : MatchStatus.PENDING,
        scoreA: draft.isBye ? 1 : 0,
        winnerTeamId: draft.isBye ? draft.teamA.teamId : null,
      },
    });
    ids.set(draft.key, row.id);
    rows.push({ ...row, draftKey: draft.key });
  }
  for (const draft of active) {
    await tx.match.update({
      where: { id: ids.get(draft.key)! },
      data: {
        nextMatchId: draft.nextMatchKey ? ids.get(draft.nextMatchKey) : null,
        nextMatchSlot: draft.nextMatchSlot,
        loserNextMatchId: draft.loserNextMatchKey
          ? ids.get(draft.loserNextMatchKey)
          : null,
        loserNextMatchSlot: draft.loserNextMatchSlot,
      },
    });
  }
  return rows;
}

function uniqueGroups(drafts: MatchDraft[]) {
  return [
    ...new Map(
      drafts
        .filter((draft) => draft.group)
        .map((draft) => [draft.group!.key, draft.group!]),
    ).values(),
  ];
}
