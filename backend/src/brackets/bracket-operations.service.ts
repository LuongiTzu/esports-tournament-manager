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
  RoundFormat,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BracketsService } from './brackets.service';
import { UpdateSeedsDto } from './dto/bracket-operations.dto';
import { BracketTeam, MatchDraft } from './types/bracket-generator';
import { StandingsService } from './standings.service';
import {
  NOOP_TOURNAMENT_EVENT_PUBLISHER,
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import { RoundSettingsService } from './round-settings.service';
import { BracketQueryService } from './bracket-query.service';
import { RoundAdvancementService } from './round-advancement.service';
import { RoundParticipantResolver } from './round-participant-resolver.service';
import { RoundGenerationReadinessService } from './round-generation-readiness.service';
import { RoundRemovalService } from './round-removal.service';
import { CompetitionMutationGuardService } from '../common/services/competition-mutation-guard.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { DownstreamResetService } from './downstream-reset.service';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';

@Injectable()
export class BracketGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher = NOOP_TOURNAMENT_EVENT_PUBLISHER,
    private readonly participants: RoundParticipantResolver = new RoundParticipantResolver(),
    private readonly readiness: RoundGenerationReadinessService = new RoundGenerationReadinessService(),
    private readonly settings: RoundSettingsService = new RoundSettingsService(),
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async preview(roundId: string, force = false) {
    const plan = await this.prisma.$transaction((tx) =>
      this.plan(tx, roundId, force),
    );
    return {
      previewToken: plan.previewToken,
      force,
      participantCount: plan.teams.length,
      matchCount: plan.drafts.length,
      bracket: buildPreviewBracket(
        plan.round,
        plan.teams,
        plan.drafts,
        this.settings,
      ),
    };
  }

  async generate(
    roundId: string,
    force = false,
    expectedPreviewToken?: string,
    actorId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const plan = await this.plan(tx, roundId, force);
      if (expectedPreviewToken && expectedPreviewToken !== plan.previewToken) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_PREVIEW_STALE,
          message:
            'Round configuration or participants changed after the preview',
        });
      }
      if (plan.hasExistingStructure) {
        await tx.match.deleteMany({ where: { roundId } });
        await tx.group.deleteMany({ where: { roundId } });
      }
      const persisted = await persistDrafts(
        tx,
        roundId,
        plan.teams,
        plan.drafts,
      );
      await this.audit.record(tx, {
        tournamentId: plan.round.tournamentId,
        actorId,
        action: plan.hasExistingStructure
          ? CompetitionAuditAction.ROUND_STRUCTURE_REGENERATED
          : CompetitionAuditAction.ROUND_STRUCTURE_GENERATED,
        roundId,
        details: {
          format: plan.round.format,
          participantCount: plan.teams.length,
          matchCount: persisted.length,
          force,
        },
      });
      return {
        tournamentId: plan.round.tournamentId,
        roundId,
        format: plan.round.format,
        approvedTeamCount: plan.teams.length,
        matchCount: persisted.length,
        force,
        matches: persisted,
      };
    });
    const { tournamentId, ...payload } = result;
    this.events.publish({ tournamentId, event: 'bracketGenerated', payload });
    return payload;
  }

  private async plan(
    tx: Prisma.TransactionClient,
    roundId: string,
    force: boolean,
  ) {
    const target = await tx.round.findUnique({
      where: { id: roundId },
      select: { id: true, tournamentId: true, orderIndex: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy vòng đấu');
    await this.readiness.assertCanGenerate(tx, target);
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
    );
    const round = await tx.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        orderIndex: true,
        format: true,
        settings: true,
        bestOf: true,
        status: true,
        _count: { select: { groups: true } },
        matches: {
          orderBy: { id: 'asc' },
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
    const hasExistingStructure =
      round.matches.length > 0 || round._count.groups > 0;
    if (hasExistingStructure) {
      if (!force) {
        throw new ConflictException('Round already has generated matches');
      }
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
    }
    const { teams } = await this.participants.resolveForGeneration(tx, round);
    validateTeamCount(round.format, teams.length, round.settings);
    const drafts = await this.brackets.generate({
      format: round.format,
      teams,
      settings: asRecord(round.settings),
      bestOf: round.bestOf,
    });
    const previewToken = generationPreviewToken({
      round,
      teams,
      drafts,
      force,
    });
    return { round, teams, drafts, previewToken, hasExistingStructure };
  }
}

@Injectable()
export class BracketOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    private readonly standings: StandingsService,
    private readonly settingsService: RoundSettingsService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher = NOOP_TOURNAMENT_EVENT_PUBLISHER,
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
    private readonly removal: RoundRemovalService = new RoundRemovalService(
      prisma,
    ),
    private readonly competitionGuard: CompetitionMutationGuardService = new CompetitionMutationGuardService(),
    private readonly participants: RoundParticipantResolver = new RoundParticipantResolver(),
    private readonly downstreamReset: DownstreamResetService = new DownstreamResetService(
      prisma,
      events,
    ),
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  previewGeneration(roundId: string, force = false) {
    return this.generation.preview(roundId, force);
  }
  generate(
    roundId: string,
    force = false,
    previewToken?: string,
    actorId?: string,
  ) {
    return this.generation.generate(roundId, force, previewToken, actorId);
  }
  async updateSeeds(roundId: string, dto: UpdateSeedsDto, actorId?: string) {
    const seeds = dto.seeds.map((item) => item.seed);
    const teamIds = dto.seeds.map((item) => item.teamId);
    if (new Set(seeds).size !== seeds.length) {
      throw new BadRequestException('Seed values must be unique');
    }
    if (new Set(teamIds).size !== teamIds.length) {
      throw new BadRequestException('Teams must not be duplicated');
    }
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true, orderIndex: true },
      });
      if (!reference) throw new NotFoundException('Không tìm thấy vòng đấu');
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.tournamentId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
      );
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true, orderIndex: true },
      });
      if (!round || round.tournamentId !== reference.tournamentId) {
        throw new NotFoundException('Không tìm thấy vòng đấu');
      }
      await this.competitionGuard.assertRoundSeedsMutable(tx, roundId);
      const { teams: eligible } = await this.participants.resolveForGeneration(
        tx,
        round,
      );
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
      if (round.orderIndex === 1) {
        for (const assignment of dto.seeds) {
          await tx.team.update({
            where: { id: assignment.teamId },
            data: { seed: assignment.seed },
          });
        }
      } else {
        const cleared = await tx.roundTeam.updateMany({
          where: { roundId, teamId: { in: teamIds } },
          data: { seed: null },
        });
        if (cleared.count !== teamIds.length) {
          throw new ConflictException({
            code: ApplicationErrorCode.ROUND_SEEDS_LOCKED,
            message: 'Round participants changed while seeds were updated',
          });
        }
        for (const assignment of dto.seeds) {
          await tx.roundTeam.update({
            where: {
              roundId_teamId: { roundId, teamId: assignment.teamId },
            },
            data: { seed: assignment.seed },
          });
        }
      }
      await this.audit.record(tx, {
        tournamentId: round.tournamentId,
        actorId,
        action: CompetitionAuditAction.ROUND_SEEDS_UPDATED,
        roundId,
        details: {
          assignments: dto.seeds.map(({ teamId, seed }) => ({ teamId, seed })),
        },
      });
      return { roundId, seeds: dto.seeds };
    });
  }

  advance(roundId: string, qualifiedTeamIds?: string[], actorId?: string) {
    return this.advancement.advance(roundId, qualifiedTeamIds, actorId);
  }
  remove(roundId: string, actorId?: string) {
    return this.removal.remove(roundId, actorId);
  }
  previewDownstreamReset(roundId: string) {
    return this.downstreamReset.preview(roundId);
  }
  resetDownstream(roundId: string, previewToken: string, actorId?: string) {
    return this.downstreamReset.reset(roundId, previewToken, actorId);
  }

  async getBracket(roundId: string) {
    return this.query.getBracket(roundId);
  }
}

function generationPreviewToken(input: {
  round: {
    id: string;
    format: RoundFormat;
    settings: unknown;
    bestOf: number;
    matches: unknown[];
    _count: { groups: number };
  };
  teams: BracketTeam[];
  drafts: MatchDraft[];
  force: boolean;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        roundId: input.round.id,
        format: input.round.format,
        settings: input.round.settings,
        bestOf: input.round.bestOf,
        force: input.force,
        existingGroups: input.round._count.groups,
        existingMatches: input.round.matches,
        teams: input.teams.map((team) => ({
          id: team.id,
          seed: team.seed,
          registeredAt: team.registeredAt.toISOString(),
        })),
        drafts: input.drafts,
      }),
    )
    .digest('hex');
}

function buildPreviewBracket(
  round: {
    id: string;
    name: string;
    orderIndex: number;
    format: RoundFormat;
    settings: unknown;
    bestOf: number;
    status: string;
  },
  teams: BracketTeam[],
  drafts: MatchDraft[],
  settingsService: RoundSettingsService,
) {
  const publicTeams = new Map(
    teams.map((team) => [
      team.id,
      {
        id: team.id,
        name: team.name,
        shortName: null,
        logoUrl: null,
        seed: team.seed,
      },
    ]),
  );
  const slotStates = resolvePreviewSlots(drafts);
  const groups = uniqueGroups(drafts).map((group) => {
    const teamIds = new Set(
      drafts
        .filter((draft) => draft.group?.key === group.key)
        .flatMap((draft) => [draft.teamA.teamId, draft.teamB.teamId])
        .filter((teamId): teamId is string => teamId !== null),
    );
    return {
      id: group.key,
      name: group.name,
      orderIndex: group.orderIndex,
      teams: teams
        .filter((team) => teamIds.has(team.id))
        .map((team) => publicTeams.get(team.id)!),
    };
  });
  return {
    round: {
      id: round.id,
      name: round.name,
      orderIndex: round.orderIndex,
      format: round.format,
      bestOf: round.bestOf,
      status: round.status,
      settings: settingsService.getEffectiveSettings(
        round.format,
        round.settings,
      ),
    },
    groups,
    matches: drafts.map((draft) => {
      const slots = slotStates.get(draft.key)!;
      const hasPotentialParticipant = Boolean(
        slots.teamAId ||
        draft.teamA.sourceMatchKey ||
        slots.teamBId ||
        draft.teamB.sourceMatchKey,
      );
      const resolvedBye =
        draft.isBye &&
        (slots.winnerTeamId !== null || !hasPotentialParticipant);
      const outcome =
        slots.winnerTeamId === null
          ? null
          : slots.winnerTeamId === slots.teamAId
            ? 'TEAM_A'
            : 'TEAM_B';
      return {
        id: draft.key,
        groupId: draft.group?.key ?? null,
        bracketRound: draft.bracketRound,
        bracketType: draft.bracketType,
        matchNumber: draft.matchNumber,
        status: resolvedBye ? 'COMPLETED' : 'PENDING',
        outcome,
        isActive: !draft.activationCondition,
        activationCondition: draft.activationCondition ?? null,
        isBye: draft.isBye,
        bestOf: draft.bestOf,
        scheduledAt: null,
        slots: {
          A: slots.teamAId ? (publicTeams.get(slots.teamAId) ?? null) : null,
          B: slots.teamBId ? (publicTeams.get(slots.teamBId) ?? null) : null,
        },
        score: {
          A: outcome === 'TEAM_A' ? 1 : 0,
          B: outcome === 'TEAM_B' ? 1 : 0,
        },
        winner: slots.winnerTeamId
          ? (publicTeams.get(slots.winnerTeamId) ?? null)
          : null,
        nextMatch: {
          id: draft.nextMatchKey,
          slot: draft.nextMatchSlot,
        },
        loserNextMatch: {
          id: draft.loserNextMatchKey,
          slot: draft.loserNextMatchSlot,
        },
      };
    }),
  };
}

function resolvePreviewSlots(drafts: MatchDraft[]) {
  const draftsByKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const states = new Map(
    drafts.map((draft) => [
      draft.key,
      {
        teamAId: draft.teamA.teamId,
        teamBId: draft.teamB.teamId,
        winnerTeamId: null as string | null,
      },
    ]),
  );
  const queue = drafts.filter((draft) => draft.isBye);
  const processed = new Set<string>();
  while (queue.length > 0) {
    const draft = queue.shift()!;
    if (processed.has(draft.key)) continue;
    const state = states.get(draft.key)!;
    const candidates = [state.teamAId, state.teamBId].filter(
      (teamId): teamId is string => teamId !== null,
    );
    if (candidates.length !== 1) continue;
    processed.add(draft.key);
    state.winnerTeamId = candidates[0];
    if (!draft.nextMatchKey || !draft.nextMatchSlot) continue;
    const target = draftsByKey.get(draft.nextMatchKey);
    const targetState = states.get(draft.nextMatchKey);
    if (!target || !targetState) {
      throw new Error('Generated bye progression target is missing');
    }
    if (draft.nextMatchSlot === 'A') {
      targetState.teamAId = candidates[0];
    } else {
      targetState.teamBId = candidates[0];
    }
    if (target.isBye) queue.push(target);
  }
  return states;
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
