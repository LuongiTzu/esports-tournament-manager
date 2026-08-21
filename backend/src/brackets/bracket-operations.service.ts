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
import {
  GroupStageSettings,
  resolveSwissNumberOfRounds,
  SwissSettings,
} from './types/round-settings';

@Injectable()
export class BracketOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    private readonly standings: StandingsService,
    private readonly settingsService: RoundSettingsService,
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
        matches: {
          select: {
            status: true,
            isActive: true,
            groupId: true,
            bracketRound: true,
          },
        },
      },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    if (
      !round.matches.length ||
      round.matches.some(
        (match) =>
          match.isActive !== false && match.status !== MatchStatus.COMPLETED,
      )
    ) {
      throw new BadRequestException('Current round is not complete');
    }
    if (
      round.format === RoundFormat.PLAYOFF ||
      round.format === RoundFormat.DOUBLE_ELIM
    ) {
      return {
        roundId,
        currentRound: {
          id: round.id,
          format: round.format,
          orderIndex: round.orderIndex,
        },
        nextRound: null,
        advanceCount: 0,
        qualifiedTeams: [],
        teamIds: [],
        progressionMode: 'MATCH_LINKAGE',
        prepared: true,
        persisted: true,
      };
    }

    const nextRound = await this.prisma.round.findFirst({
      where: {
        tournamentId: round.tournamentId,
        orderIndex: { gt: round.orderIndex },
      },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, format: true, settings: true },
    });
    if (!nextRound) throw new BadRequestException('No next round exists');

    const settings = asRecord(round.settings) ?? {};
    const result = await this.standings.forTournament(round.tournamentId, [
      { id: round.id, format: round.format, settings: round.settings },
    ]);

    let configuredAdvanceCount: number | undefined;
    if (round.format === RoundFormat.SWISS) {
      const swissSettings = this.settingsService.getEffectiveSettings(
        RoundFormat.SWISS,
        round.settings,
      ) as SwissSettings;
      const swissStandings = result.rounds[0].standings as Array<{
        teamId: string;
      }>;
      const numberOfRounds = resolveSwissNumberOfRounds(
        swissStandings.length,
        swissSettings.numberOfRounds,
      );
      const currentSwissRound = Math.max(
        0,
        ...round.matches.map((match) => match.bracketRound ?? 0),
      );
      if (currentSwissRound !== numberOfRounds) {
        throw new BadRequestException(
          'Swiss advancement is only available after the final configured round',
        );
      }
      configuredAdvanceCount = swissSettings.advancingTeamCount;
    }

    if (round.format === RoundFormat.GROUP_STAGE) {
      const groupSettings = this.settingsService.getEffectiveSettings(
        RoundFormat.GROUP_STAGE,
        round.settings,
      ) as GroupStageSettings;
      const { numberOfGroups, advancingTeamsPerGroup, meetingsPerPair } =
        groupSettings;

      const groups = result.rounds[0].standings as Array<{
        groupId: string;
        name: string;
        orderIndex: number;
        standings: Array<{ teamId?: string; id?: string }>;
      }>;
      if (groups.length !== numberOfGroups || groups.length === 0) {
        throw new BadRequestException(
          'Persisted groups do not match GROUP_STAGE settings',
        );
      }
      const teamsPerGroup = groups[0].standings.length;
      if (
        teamsPerGroup < 2 ||
        groups.some((group) => group.standings.length !== teamsPerGroup) ||
        advancingTeamsPerGroup >= teamsPerGroup
      ) {
        throw new BadRequestException(
          'Persisted groups do not match GROUP_STAGE settings',
        );
      }

      const matchesPerGroup =
        ((teamsPerGroup * (teamsPerGroup - 1)) / 2) * meetingsPerPair;
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
          .slice(0, advancingTeamsPerGroup)
          .map((row) => row.teamId ?? row.id!),
      }));
      const teamIds = qualifiedGroups.flatMap((group) => group.teamIds);
      return this.persistAdvancement({
        round,
        nextRound,
        teamIds,
        advanceCountPerGroup: advancingTeamsPerGroup,
        groups: qualifiedGroups,
      });
    }

    configuredAdvanceCount ??= Number(settings.advanceCount ?? 0);
    if (
      !Number.isInteger(configuredAdvanceCount) ||
      configuredAdvanceCount < 1
    ) {
      throw new BadRequestException(
        'Round format does not define advanceCount',
      );
    }
    const standings = result.rounds[0].standings as Array<{
      teamId?: string;
      id?: string;
    }>;
    const teamIds = standings
      .slice(0, configuredAdvanceCount)
      .map((row) => row.teamId ?? row.id!);
    return this.persistAdvancement({ round, nextRound, teamIds });
  }

  private async persistAdvancement(input: {
    round: {
      id: string;
      tournamentId: string;
      orderIndex: number;
      format: RoundFormat;
    };
    nextRound: {
      id: string;
      name: string;
      format: RoundFormat;
      settings: unknown;
    };
    teamIds: string[];
    advanceCountPerGroup?: number;
    groups?: Array<{
      groupId: string;
      name: string;
      orderIndex: number;
      teamIds: string[];
    }>;
  }) {
    const uniqueTeamIds = [...new Set(input.teamIds)];
    if (
      !uniqueTeamIds.length ||
      uniqueTeamIds.length !== input.teamIds.length
    ) {
      throw new BadRequestException('Invalid qualified team selection');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${input.round.id} FOR UPDATE`,
      );
      const current = await tx.round.findUnique({
        where: { id: input.round.id },
        select: {
          id: true,
          tournamentId: true,
          orderIndex: true,
          format: true,
          matches: { select: { status: true } },
        },
      });
      if (!current) {
        throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y vÃ²ng Ä‘áº¥u');
      }
      if (
        current.tournamentId !== input.round.tournamentId ||
        current.format !== input.round.format ||
        !current.matches.length ||
        current.matches.some((match) => match.status !== MatchStatus.COMPLETED)
      ) {
        throw new BadRequestException('Current round is not complete');
      }

      const durableNextRound = await tx.round.findFirst({
        where: {
          tournamentId: current.tournamentId,
          orderIndex: { gt: current.orderIndex },
        },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, name: true, format: true, settings: true },
      });
      if (!durableNextRound || durableNextRound.id !== input.nextRound.id) {
        throw new BadRequestException('Next round configuration changed');
      }

      const existing = await tx.roundTeam.findFirst({
        where: {
          OR: [
            { advancedFromRoundId: current.id },
            { roundId: durableNextRound.id },
          ],
        },
        select: { roundId: true },
      });
      if (existing) {
        throw new ConflictException('Round advancement is already persisted');
      }

      const eligible = await tx.team.findMany({
        where: {
          id: { in: uniqueTeamIds },
          tournamentId: current.tournamentId,
          status: RegistrationStatus.APPROVED,
        },
        select: { id: true, name: true, seed: true },
      });
      if (eligible.length !== uniqueTeamIds.length) {
        throw new BadRequestException(
          'Every qualified team must be approved and belong to the tournament',
        );
      }

      validateTeamCount(
        durableNextRound.format,
        uniqueTeamIds.length,
        durableNextRound.settings,
      );

      await tx.roundTeam.createMany({
        data: uniqueTeamIds.map((teamId) => ({
          roundId: durableNextRound.id,
          teamId,
          advancedFromRoundId: current.id,
        })),
      });
      const eligibleById = new Map(eligible.map((team) => [team.id, team]));
      const qualifiedTeams = uniqueTeamIds.map((teamId) =>
        eligibleById.get(teamId)!,
      );

      return {
        roundId: current.id,
        currentRound: {
          id: current.id,
          format: current.format,
          orderIndex: current.orderIndex,
        },
        nextRound: {
          id: durableNextRound.id,
          name: durableNextRound.name,
          format: durableNextRound.format,
        },
        advanceCount: qualifiedTeams.length,
        ...(input.advanceCountPerGroup
          ? { advanceCountPerGroup: input.advanceCountPerGroup }
          : {}),
        ...(input.groups ? { groups: input.groups } : {}),
        qualifiedTeams,
        teamIds: qualifiedTeams.map((team) => team.id),
        progressionMode: 'ROUND_PARTICIPANTS',
        prepared: true,
        persisted: true,
      };
    });
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
        settings: this.settingsService.getEffectiveSettings(
          round.format,
          round.settings,
        ),
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
        isActive: match.isActive,
        activationCondition: match.activationCondition,
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
