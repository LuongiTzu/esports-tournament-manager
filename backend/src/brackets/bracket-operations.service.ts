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
import { RoundSettingsService } from './round-settings.service';
import { BracketQueryService } from './bracket-query.service';
import { RoundAdvancementService } from './round-advancement.service';

@Injectable()
export class BracketGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    @Optional() private readonly events?: TournamentEventsService,
  ) {}

  async generate(roundId: string, force = false) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
      );
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
      const teams = await loadEligibleTeams(tx, round.id, round.tournamentId);
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
    this.events?.publish({ tournamentId, event: 'bracketGenerated', payload });
    return payload;
  }
}

@Injectable()
export class BracketOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    private readonly standings: StandingsService,
    private readonly settingsService: RoundSettingsService,
    @Optional() private readonly events?: TournamentEventsService,
    private readonly query: BracketQueryService = new BracketQueryService(
      prisma,
      settingsService,
    ),
    private readonly generation: BracketGenerationService = new BracketGenerationService(
      prisma,
      brackets,
      events,
    ),
    private readonly advancement: RoundAdvancementService = new RoundAdvancementService(
      prisma,
      standings,
      settingsService,
    ),
  ) {}

  generate(roundId: string, force = false) {
    return this.generation.generate(roundId, force);
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

  advance(roundId: string) {
    return this.advancement.advance(roundId);
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
    return this.query.getBracket(roundId);
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
    const numberOfGroups = Number(
      settings?.numberOfGroups ?? settings?.numGroups,
    );
    if (
      !Number.isInteger(numberOfGroups) ||
      numberOfGroups < 2 ||
      numberOfGroups > count ||
      count % numberOfGroups !== 0
    ) {
      throw new BadRequestException(
        `GROUP_STAGE requires ${count} approved teams to divide equally into ${numberOfGroups} groups`,
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

async function loadEligibleTeams(
  tx: Prisma.TransactionClient,
  roundId: string,
  tournamentId: string,
) {
  const assignments = await tx.roundTeam.findMany({
    where: { roundId },
    orderBy: { createdAt: 'asc' },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          seed: true,
          registeredAt: true,
          tournamentId: true,
          status: true,
        },
      },
    },
  });
  if (assignments.length) {
    return assignments
      .map((assignment) => assignment.team)
      .filter(
        (team) =>
          team.tournamentId === tournamentId &&
          team.status === RegistrationStatus.APPROVED,
      )
      .map((team) => ({
        id: team.id,
        name: team.name,
        seed: team.seed,
        registeredAt: team.registeredAt,
      }));
  }
  return tx.team.findMany({
    where: { tournamentId, status: RegistrationStatus.APPROVED },
    select: { id: true, name: true, seed: true, registeredAt: true },
  });
}

async function persistDrafts(
  tx: Prisma.TransactionClient,
  roundId: string,
  teams: Array<{ id: string }>,
  drafts: MatchDraft[],
) {
  const active = drafts;
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
    const byeWinnerTeamId = draft.isBye
      ? (draft.teamA.teamId ?? draft.teamB.teamId)
      : null;
    const hasPotentialByeParticipant = Boolean(
      draft.teamA.teamId ||
      draft.teamA.sourceMatchKey ||
      draft.teamB.teamId ||
      draft.teamB.sourceMatchKey,
    );
    const resolvedBye =
      draft.isBye && (byeWinnerTeamId !== null || !hasPotentialByeParticipant);
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
        isActive: !draft.activationCondition,
        activationCondition: draft.activationCondition,
        bestOf: draft.bestOf,
        status: resolvedBye ? MatchStatus.COMPLETED : MatchStatus.PENDING,
        scoreA:
          byeWinnerTeamId !== null && byeWinnerTeamId === draft.teamA.teamId
            ? 1
            : 0,
        scoreB:
          byeWinnerTeamId !== null && byeWinnerTeamId === draft.teamB.teamId
            ? 1
            : 0,
        winnerTeamId: byeWinnerTeamId,
        outcome:
          byeWinnerTeamId !== null && byeWinnerTeamId === draft.teamA.teamId
            ? 'TEAM_A'
            : byeWinnerTeamId !== null && byeWinnerTeamId === draft.teamB.teamId
              ? 'TEAM_B'
              : null,
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
  await propagateInitialByeWinners(tx, active, ids);
  return rows;
}

async function propagateInitialByeWinners(
  tx: Prisma.TransactionClient,
  drafts: MatchDraft[],
  ids: Map<string, string>,
) {
  const draftsByKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const assigned = new Map(
    drafts.map((draft) => [
      draft.key,
      { teamAId: draft.teamA.teamId, teamBId: draft.teamB.teamId },
    ]),
  );
  const queue = drafts
    .filter((draft) => draft.isBye && draft.teamA.teamId)
    .map((draft) => ({ draft, winnerTeamId: draft.teamA.teamId! }));

  while (queue.length) {
    const { draft, winnerTeamId } = queue.shift()!;
    if (!draft.nextMatchKey || !draft.nextMatchSlot) continue;
    const target = draftsByKey.get(draft.nextMatchKey);
    const targetState = assigned.get(draft.nextMatchKey);
    if (!target || !targetState) {
      throw new Error('Generated bye progression target is missing');
    }
    const field = draft.nextMatchSlot === 'A' ? 'teamAId' : 'teamBId';
    if (targetState[field] && targetState[field] !== winnerTeamId) {
      throw new Error('Generated bye progression slot is already occupied');
    }
    targetState[field] = winnerTeamId;
    const completesBye = target.isBye;
    await tx.match.update({
      where: { id: ids.get(target.key)! },
      data: {
        [field]: winnerTeamId,
        ...(completesBye
          ? {
              status: MatchStatus.COMPLETED,
              scoreA: field === 'teamAId' ? 1 : 0,
              scoreB: field === 'teamBId' ? 1 : 0,
              winnerTeamId,
              outcome: field === 'teamAId' ? 'TEAM_A' : 'TEAM_B',
            }
          : {}),
      },
    });
    if (completesBye) queue.push({ draft: target, winnerTeamId });
  }
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
