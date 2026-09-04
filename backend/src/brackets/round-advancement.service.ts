import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  MatchStatus,
  Prisma,
  RegistrationStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { RoundSettingsService } from './round-settings.service';
import { StandingsService } from './standings.service';
import {
  GroupStageSettings,
  RoundRobinSettings,
  resolveSwissNumberOfRounds,
  SwissSettings,
} from './types/round-settings';
import { analyzeQualificationBoundary } from './domain/qualification-boundary';
import {
  assignRoundSeeds,
  interleaveGroupQualificationOrder,
} from './domain/round-seeding';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';

@Injectable()
export class RoundAdvancementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly standings: StandingsService,
    private readonly settingsService: RoundSettingsService,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async advance(
    roundId: string,
    qualifiedTeamIds?: string[],
    actorId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true },
      });
      if (!reference) throw new NotFoundException('Không tìm thấy vòng đấu');

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.tournamentId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "matches" WHERE "round_id" = ${roundId} ORDER BY "id" FOR UPDATE`,
      );

      const round = await tx.round.findUnique({
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
      if (!round || round.tournamentId !== reference.tournamentId) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_ADVANCEMENT_SNAPSHOT_CHANGED,
          message: 'Round changed during advancement',
        });
      }
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
        return eliminationProgressionResult(round);
      }

      const nextRoundWhere = {
        tournamentId: round.tournamentId,
        orderIndex: { gt: round.orderIndex },
      } as const;
      const nextReference = await tx.round.findFirst({
        where: nextRoundWhere,
        orderBy: { orderIndex: 'asc' },
        select: { id: true },
      });
      if (!nextReference) {
        throw new BadRequestException('No next round exists');
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${nextReference.id} FOR UPDATE`,
      );
      const nextRound = await tx.round.findFirst({
        where: nextRoundWhere,
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          name: true,
          format: true,
          settings: true,
          _count: { select: { groups: true, matches: true } },
        },
      });
      if (!nextRound || nextRound.id !== nextReference.id) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_ADVANCEMENT_SNAPSHOT_CHANGED,
          message: 'Next round configuration changed',
        });
      }
      if (nextRound._count.groups > 0 || nextRound._count.matches > 0) {
        throw new ConflictException({
          code: ApplicationErrorCode.NEXT_ROUND_ALREADY_GENERATED,
          message:
            'Cannot change qualification after the next Round has a structure',
        });
      }

      const result = await this.standings.forTournament(
        round.tournamentId,
        [{ id: round.id, format: round.format, settings: round.settings }],
        tx,
      );
      const settings = asRecord(round.settings) ?? {};
      let configuredAdvanceCount: number | undefined;
      if (round.format === RoundFormat.ROUND_ROBIN) {
        const roundRobinSettings = this.settingsService.getEffectiveSettings(
          RoundFormat.ROUND_ROBIN,
          round.settings,
        ) as RoundRobinSettings;
        configuredAdvanceCount = roundRobinSettings.advancingTeamCount;
      }
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
          standings: BasicQualificationStanding[];
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
        const groupPlans = groups.map((group) =>
          qualificationPlan({
            key: group.groupId,
            scope: 'GROUP',
            groupId: group.groupId,
            groupName: group.name,
            advanceCount: advancingTeamsPerGroup,
            rows: group.standings.map(toBasicQualificationTeam),
          }),
        );
        const resolved = resolveQualificationPlans(
          groupPlans,
          qualifiedTeamIds,
        );
        const qualifiedGroups = groups.map((group) => ({
          groupId: group.groupId,
          name: group.name,
          orderIndex: group.orderIndex,
          teamIds: resolved.get(group.groupId)!,
        }));
        return this.persistAdvancement(tx, {
          round,
          nextRound,
          teamIds: interleaveGroupQualificationOrder(qualifiedGroups),
          advanceCountPerGroup: advancingTeamsPerGroup,
          groups: qualifiedGroups,
          actorId,
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
      const standings = result.rounds[0].standings as Array<
        BasicQualificationStanding | SwissQualificationStanding
      >;
      const rows =
        round.format === RoundFormat.SWISS
          ? standings.map((row) =>
              toSwissQualificationTeam(row as SwissQualificationStanding),
            )
          : standings.map((row) =>
              toBasicQualificationTeam(row as BasicQualificationStanding),
            );
      const resolved = resolveQualificationPlans(
        [
          qualificationPlan({
            key: round.id,
            scope: 'ROUND',
            advanceCount: configuredAdvanceCount,
            rows,
          }),
        ],
        qualifiedTeamIds,
      );
      const teamIds = resolved.get(round.id)!;
      return this.persistAdvancement(tx, {
        round,
        nextRound,
        teamIds,
        actorId,
      });
    });
  }

  private async persistAdvancement(
    tx: Prisma.TransactionClient,
    input: {
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
      actorId?: string;
    },
  ) {
    const uniqueTeamIds = [...new Set(input.teamIds)];
    if (
      !uniqueTeamIds.length ||
      uniqueTeamIds.length !== input.teamIds.length
    ) {
      throw new BadRequestException('Invalid qualified team selection');
    }

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
      throw new ConflictException({
        code: ApplicationErrorCode.ROUND_ADVANCEMENT_SNAPSHOT_CHANGED,
        message: 'Next round configuration changed',
      });
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
      throw new ConflictException({
        code: ApplicationErrorCode.ROUND_ADVANCEMENT_ALREADY_PERSISTED,
        message: 'Round advancement is already persisted',
      });
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

    const seedAssignments = assignRoundSeeds(uniqueTeamIds);
    await tx.roundTeam.createMany({
      data: seedAssignments.map(({ teamId, seed }) => ({
        roundId: durableNextRound.id,
        teamId,
        advancedFromRoundId: current.id,
        seed,
      })),
    });
    const eligibleById = new Map(eligible.map((team) => [team.id, team]));
    const qualifiedTeams = seedAssignments.map(({ teamId, seed }) => ({
      ...eligibleById.get(teamId)!,
      seed,
    }));

    await this.audit.record(tx, {
      tournamentId: current.tournamentId,
      actorId: input.actorId,
      action: CompetitionAuditAction.ROUND_ADVANCEMENT_CONFIRMED,
      roundId: current.id,
      details: {
        nextRoundId: durableNextRound.id,
        qualifiedTeamIds: qualifiedTeams.map((team) => team.id),
      },
    });

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
  }
}

interface BasicQualificationStanding {
  id?: string;
  teamId?: string;
  name?: string;
  seed?: number | null;
  points?: number;
  wins?: number;
  scoreDifference?: number;
}

interface SwissQualificationStanding {
  teamId: string;
  team?: { name?: string; seed?: number | null } | null;
  points?: number;
  buchholz?: number;
  buchholzCut1?: number;
  scoreDifference?: number;
}

interface QualificationTeam {
  teamId: string;
  name: string;
  seed: number | null;
  metrics: number[];
}

interface QualificationPlan {
  key: string;
  scope: 'ROUND' | 'GROUP';
  groupId?: string;
  groupName?: string;
  advanceCount: number;
  rows: QualificationTeam[];
  automaticTeamIds: string[];
  tie: ReturnType<typeof analyzeQualificationBoundary>['tie'];
}

function qualificationPlan(
  input: Omit<QualificationPlan, 'automaticTeamIds' | 'tie'>,
): QualificationPlan {
  let analysis: ReturnType<typeof analyzeQualificationBoundary>;
  try {
    analysis = analyzeQualificationBoundary(input.rows, input.advanceCount);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Invalid qualification rules',
    );
  }
  return { ...input, ...analysis };
}

function resolveQualificationPlans(
  plans: QualificationPlan[],
  selectedTeamIds?: string[],
): Map<string, string[]> {
  const expectedAdvanceCount = plans.reduce(
    (sum, plan) => sum + plan.advanceCount,
    0,
  );
  const tiedPlans = plans.filter((plan) => plan.tie);
  const fixedTeamIds = plans.flatMap((plan) =>
    plan.tie ? plan.tie.guaranteedTeamIds : plan.automaticTeamIds,
  );

  if (tiedPlans.length && !selectedTeamIds) {
    const teamsById = new Map(
      plans.flatMap((plan) => plan.rows.map((team) => [team.teamId, team])),
    );
    throw new ConflictException({
      code: ApplicationErrorCode.ROUND_TIE_BREAK_REQUIRED,
      message:
        'Organizer selection is required because teams are tied at the qualification boundary',
      details: {
        advanceCount: expectedAdvanceCount,
        fixedQualifiedTeams: fixedTeamIds.map((teamId) =>
          publicQualificationTeam(teamsById.get(teamId)!),
        ),
        tieBreaks: tiedPlans.map((plan) => ({
          scope: plan.scope,
          groupId: plan.groupId ?? null,
          groupName: plan.groupName ?? null,
          requiredSelections: plan.tie!.requiredSelections,
          candidates: plan.tie!.candidateTeamIds.map((teamId) =>
            publicQualificationTeam(teamsById.get(teamId)!),
          ),
        })),
      },
    });
  }

  const selected = selectedTeamIds ?? fixedTeamIds;
  const selectedSet = new Set(selected);
  if (
    selected.length !== expectedAdvanceCount ||
    selectedSet.size !== selected.length
  ) {
    throw invalidTieBreakSelection(
      `Exactly ${expectedAdvanceCount} unique qualified teams are required`,
    );
  }

  const resolved = new Map<string, string[]>();
  for (const plan of plans) {
    const rowIds = new Set(plan.rows.map((row) => row.teamId));
    const selectedForPlan = selected.filter((teamId) => rowIds.has(teamId));
    const allowedIds = new Set(
      plan.tie
        ? [...plan.tie.guaranteedTeamIds, ...plan.tie.candidateTeamIds]
        : plan.automaticTeamIds,
    );
    if (
      selectedForPlan.length !== plan.advanceCount ||
      selectedForPlan.some((teamId) => !allowedIds.has(teamId)) ||
      (plan.tie?.guaranteedTeamIds ?? []).some(
        (teamId) => !selectedSet.has(teamId),
      )
    ) {
      throw invalidTieBreakSelection(
        'Selected teams do not satisfy the qualification boundary',
      );
    }
    resolved.set(
      plan.key,
      plan.rows
        .filter((row) => selectedSet.has(row.teamId))
        .map((row) => row.teamId),
    );
  }

  if ([...resolved.values()].flat().length !== selected.length) {
    throw invalidTieBreakSelection(
      'Every selected team must belong to the current standings',
    );
  }
  return resolved;
}

function toBasicQualificationTeam(
  row: BasicQualificationStanding,
): QualificationTeam {
  const teamId = row.teamId ?? row.id;
  if (!teamId) throw new BadRequestException('Standing row has no team ID');
  return {
    teamId,
    name: row.name ?? teamId,
    seed: row.seed ?? null,
    metrics: [row.points, row.wins, row.scoreDifference].map(numberMetric),
  };
}

function toSwissQualificationTeam(
  row: SwissQualificationStanding,
): QualificationTeam {
  return {
    teamId: row.teamId,
    name: row.team?.name ?? row.teamId,
    seed: row.team?.seed ?? null,
    metrics: [
      row.points,
      row.buchholz,
      row.buchholzCut1,
      row.scoreDifference,
    ].map(numberMetric),
  };
}

function numberMetric(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0;
}

function publicQualificationTeam(team: QualificationTeam) {
  return { teamId: team.teamId, name: team.name, seed: team.seed };
}

function invalidTieBreakSelection(message: string) {
  return new BadRequestException({
    code: ApplicationErrorCode.ROUND_TIE_BREAK_SELECTION_INVALID,
    message,
  });
}

function eliminationProgressionResult(round: {
  id: string;
  format: RoundFormat;
  orderIndex: number;
}) {
  return {
    roundId: round.id,
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
