import {
  MatchOutcome,
  MatchStatus,
  Role,
  RoundFormat,
  TournamentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { GAME_CATALOG_CODES } from '../../src/games/game-catalog';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RegistrationRosterPolicy } from '../../src/teams/domain/registration-roster.policy';
import { TournamentTeamSizePolicy } from '../../src/tournaments/domain/tournament-team-size.policy';
import {
  DEVELOPMENT_PASSWORD,
  SEED_EMAIL_DOMAIN,
  SEED_SLUG_PREFIX,
  SEED_USERS,
} from './data';

const rosterPolicy = new RegistrationRosterPolicy();
const teamSizePolicy = new TournamentTeamSizePolicy();

const CANONICAL_SETTING_KEYS: Record<RoundFormat, Set<string>> = {
  [RoundFormat.ROUND_ROBIN]: new Set([
    'winPoints',
    'drawPoints',
    'lossPoints',
    'allowDraws',
    'meetingsPerPair',
  ]),
  [RoundFormat.GROUP_STAGE]: new Set([
    'numberOfGroups',
    'advancingTeamsPerGroup',
    'winPoints',
    'drawPoints',
    'lossPoints',
    'allowDraws',
    'meetingsPerPair',
  ]),
  [RoundFormat.SWISS]: new Set(['numberOfRounds', 'advancingTeamCount']),
  [RoundFormat.PLAYOFF]: new Set(['thirdPlaceMatch']),
  [RoundFormat.DOUBLE_ELIM]: new Set(['grandFinalReset']),
};

export interface SeedSummary {
  users: number;
  admins: number;
  signedUpUsers: number;
  organizerOwners: number;
  games: number;
  tournaments: number;
  rounds: number;
  groups: number;
  teams: number;
  members: number;
  matches: number;
  completedMatches: number;
  ongoingMatches: number;
  pendingMatches: number;
  draws: number;
  byes: number;
  teamStatuses: Record<string, number>;
  tournamentStatuses: Record<string, number>;
  tournamentVisibility: Record<string, number>;
  tournamentModes: Record<string, number>;
  tournamentsByGame: Record<string, number>;
  roundsByFormat: Record<string, number>;
}

export async function validateSeed(
  prisma: PrismaService,
): Promise<SeedSummary> {
  const [users, games, tournaments] = await Promise.all([
    prisma.user.findMany({
      where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
      include: { organizedTournaments: true },
    }),
    prisma.game.findMany({ orderBy: { name: 'asc' } }),
    prisma.tournament.findMany({
      where: { slug: { startsWith: SEED_SLUG_PREFIX } },
      include: {
        game: true,
        teams: { include: { members: true } },
        rounds: {
          include: {
            groups: { include: { teamAssignments: true } },
            matches: true,
            participants: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  assert(
    users.length === 30,
    `Expected 30 seeded users, found ${users.length}`,
  );
  assert(
    users.filter((user) => user.role === Role.ADMIN).length === 2,
    'Expected exactly 2 seeded admins',
  );
  assert(
    users.filter((user) => user.role === Role.SIGNED_UP_USER).length === 28,
    'Expected exactly 28 signed-up users',
  );
  assert(
    new Set(
      users.flatMap((user) => user.organizedTournaments.map(() => user.id)),
    ).size === 8,
    'Expected exactly 8 organizer owners',
  );
  assert(
    new Set(users.map((user) => user.email)).size === users.length,
    'Seeded user emails must be unique',
  );
  for (const user of users) {
    assert(
      await bcrypt.compare(DEVELOPMENT_PASSWORD, user.passwordHash),
      `Development password does not match ${user.email}`,
    );
  }

  const gameCodes = new Set(games.map((game) => game.code));
  assert(
    GAME_CATALOG_CODES.every((code) => gameCodes.has(code)),
    'Database is missing one or more canonical games',
  );
  assert(tournaments.length === 20, 'Expected exactly 20 seeded tournaments');
  assert(
    new Set(tournaments.map((tournament) => tournament.game.code)).size === 15,
    'Expected all 15 canonical games to have seeded tournaments',
  );

  for (const tournament of tournaments) {
    const gameSizeRules = {
      teamSizeMode: tournament.game.teamSizeMode,
      defaultTeamSize: tournament.game.defaultTeamSize,
      maxTeamSize: tournament.game.maxTeamSize,
      allowedTeamSizes: tournament.game.allowedTeamSizes,
      minSelectableTeamSize: tournament.game.minSelectableTeamSize,
      maxSelectableTeamSize: tournament.game.maxSelectableTeamSize,
    };
    assert(
      teamSizePolicy.resolveTeamSize(gameSizeRules, tournament.minTeamSize) ===
        tournament.minTeamSize,
      `${tournament.slug} has an invalid active-team snapshot`,
    );
    assert(
      teamSizePolicy.validateMaxTeamSize(
        gameSizeRules,
        tournament.minTeamSize,
        tournament.maxTeamSize,
      ) === tournament.maxTeamSize,
      `${tournament.slug} has an invalid roster-cap snapshot`,
    );
    assert(
      tournament.game.code === 'CUSTOM'
        ? Boolean(tournament.customGameName?.trim())
        : tournament.customGameName === null,
      `${tournament.slug} has inconsistent custom-game metadata`,
    );

    for (const team of tournament.teams) {
      assert(Boolean(team.contactName), `${team.name} lacks contactName`);
      assert(Boolean(team.contactEmail), `${team.name} lacks contactEmail`);
      assert(Boolean(team.contactPhone), `${team.name} lacks contactPhone`);
      const rosterResult = rosterPolicy.validate(
        {
          tournamentId: tournament.id,
          minTeamSize: tournament.minTeamSize,
          maxTeamSize: tournament.maxTeamSize,
          minAge: null,
          maxAge: null,
          allowedGenders: null,
          requireMemberFullInfo: false,
          startDate: tournament.startDate,
          positions: asStringArray(tournament.game.positions),
          positionMode: tournament.game.positionMode,
        },
        team.members.map((member) => ({
          realName: member.realName,
          ign: member.ign,
          inGameId: member.inGameId ?? undefined,
          birthDate: member.birthDate?.toISOString(),
          gender: member.gender ?? undefined,
          email: member.email ?? undefined,
          phoneNumber: member.phoneNumber ?? undefined,
          position: member.position ?? undefined,
          memberRole: member.memberRole,
        })),
      );
      assert(
        rosterResult.errors.length === 0,
        `${team.name} has an invalid roster: ${rosterResult.errors
          .map((error) => error.message)
          .join('; ')}`,
      );
    }

    for (const round of tournament.rounds) {
      const settings = asRecord(round.settings);
      assert(Boolean(settings), `${round.id} must have canonical settings`);
      assert(
        Object.keys(settings!).every((key) =>
          CANONICAL_SETTING_KEYS[round.format].has(key),
        ),
        `${round.id} contains a non-canonical setting`,
      );

      if (round.format === RoundFormat.GROUP_STAGE && round.groups.length) {
        const expectedGroups = Number(settings!.numberOfGroups);
        assert(
          round.groups.length === expectedGroups,
          `${round.id} group count does not match settings`,
        );
        const groupSizes = round.groups.map(
          (group) => group.teamAssignments.length,
        );
        assert(
          new Set(groupSizes).size === 1,
          `${round.id} contains unequal groups`,
        );
        const meetingsPerPair = Number(settings!.meetingsPerPair);
        const groupSize = groupSizes[0];
        const expectedMatches =
          (groupSize * (groupSize - 1) * meetingsPerPair) / 2;
        for (const group of round.groups) {
          const teamIds = new Set(
            group.teamAssignments.map((assignment) => assignment.teamId),
          );
          const matches = round.matches.filter(
            (match) => match.groupId === group.id,
          );
          assert(
            matches.length === expectedMatches,
            `${group.id} has the wrong match count`,
          );
          assert(
            matches.every(
              (match) =>
                match.teamAId &&
                match.teamBId &&
                teamIds.has(match.teamAId) &&
                teamIds.has(match.teamBId),
            ),
            `${group.id} contains a cross-group match`,
          );
        }
        const assignedTeamIds = round.groups.flatMap((group) =>
          group.teamAssignments.map((assignment) => assignment.teamId),
        );
        assert(
          assignedTeamIds.length === new Set(assignedTeamIds).size,
          `${round.id} assigns a team to more than one group`,
        );
      }

      if (round.format === RoundFormat.ROUND_ROBIN && round.matches.length) {
        const participants = tournament.teams.filter(
          (team) => team.status === 'APPROVED',
        ).length;
        const expectedMatches =
          (participants *
            (participants - 1) *
            Number(settings!.meetingsPerPair)) /
          2;
        assert(
          round.matches.length === expectedMatches,
          `${round.id} has the wrong Round Robin match count`,
        );
        const pairCounts = new Map<string, number>();
        for (const match of round.matches) {
          assert(
            match.teamAId !== match.teamBId,
            `${match.id} is an invalid self-match`,
          );
          const pair = [match.teamAId, match.teamBId].sort().join(':');
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        }
        assert(
          [...pairCounts.values()].every(
            (count) => count === Number(settings!.meetingsPerPair),
          ),
          `${round.id} does not schedule each pair the configured number of times`,
        );
      }

      if (round.format === RoundFormat.SWISS && round.matches.length) {
        const iterations = new Map<number, string[]>();
        for (const match of round.matches) {
          const iteration = match.bracketRound ?? 0;
          const teams = iterations.get(iteration) ?? [];
          if (match.teamAId) teams.push(match.teamAId);
          if (match.teamBId) teams.push(match.teamBId);
          iterations.set(iteration, teams);
          assert(
            match.teamAId !== match.teamBId,
            `${match.id} is an invalid Swiss self-match`,
          );
        }
        assert(
          [...iterations.values()].every(
            (teamIds) => teamIds.length === new Set(teamIds).size,
          ),
          `${round.id} repeats a team within one Swiss iteration`,
        );
      }

      for (const match of round.matches) {
        const completedDraw =
          match.status === MatchStatus.COMPLETED &&
          match.outcome === MatchOutcome.DRAW;
        if (completedDraw) {
          assert(
            (round.format === RoundFormat.ROUND_ROBIN ||
              round.format === RoundFormat.GROUP_STAGE) &&
              settings!.allowDraws === true &&
              match.winnerTeamId === null &&
              match.scoreA === match.scoreB,
            `${match.id} is an invalid draw`,
          );
        }
        if (
          match.status === MatchStatus.COMPLETED &&
          !match.isBye &&
          match.scoreA === match.scoreB
        ) {
          assert(
            match.outcome === MatchOutcome.DRAW,
            `${match.id} has an ambiguous completed tie`,
          );
        }
        if (
          round.format === RoundFormat.SWISS ||
          round.format === RoundFormat.PLAYOFF ||
          round.format === RoundFormat.DOUBLE_ELIM
        ) {
          assert(
            match.outcome !== MatchOutcome.DRAW,
            `${match.id} draws are forbidden for ${round.format}`,
          );
        }
      }
    }

    const orderedRounds = [...tournament.rounds].sort(
      (left, right) => left.orderIndex - right.orderIndex,
    );
    if (orderedRounds.length === 2 && orderedRounds[1].matches.length) {
      const source = orderedRounds[0];
      const target = orderedRounds[1];
      const sourceSettings = asRecord(source.settings)!;
      const expectedQualifiers =
        source.format === RoundFormat.GROUP_STAGE
          ? Number(sourceSettings.numberOfGroups) *
            Number(sourceSettings.advancingTeamsPerGroup)
          : Number(sourceSettings.advancingTeamCount);
      assert(
        target.participants.length === expectedQualifiers,
        `${target.id} has the wrong qualified-team count`,
      );
      assert(
        target.participants.every(
          (participant) => participant.advancedFromRoundId === source.id,
        ),
        `${target.id} has invalid qualification provenance`,
      );
    }

    if (tournament.status === TournamentStatus.COMPLETED) {
      assert(
        tournament.rounds.every((round) => round.status === 'COMPLETED'),
        `${tournament.slug} has an incomplete round`,
      );
    }

    if (
      tournament.status === TournamentStatus.COMPLETED &&
      tournament.rounds.some(
        (round) =>
          round.format === RoundFormat.PLAYOFF ||
          round.format === RoundFormat.DOUBLE_ELIM,
      )
    ) {
      assert(
        tournament.teams.filter((team) => team.finalRank === 1).length === 1,
        `${tournament.slug} must have exactly one champion`,
      );
    }
  }

  const allTeams = tournaments.flatMap((tournament) => tournament.teams);
  const allMembers = allTeams.flatMap((team) => team.members);
  const allRounds = tournaments.flatMap((tournament) => tournament.rounds);
  const allGroups = allRounds.flatMap((round) => round.groups);
  const allMatches = allRounds.flatMap((round) => round.matches);
  const imageUrls = [
    ...users.map((user) => user.avatarUrl),
    ...tournaments.map((tournament) => tournament.bannerUrl),
    ...allTeams.map((team) => team.logoUrl),
    ...allMembers.map((member) => member.avatarUrl),
  ];
  assert(
    imageUrls.every((url) => !url?.startsWith('/uploads/')),
    'Seed data must not contain fake upload paths',
  );

  return {
    users: users.length,
    admins: users.filter((user) => user.role === Role.ADMIN).length,
    signedUpUsers: users.filter((user) => user.role === Role.SIGNED_UP_USER)
      .length,
    organizerOwners: SEED_USERS.filter((user) => user.persona === 'ORGANIZER')
      .length,
    games: games.length,
    tournaments: tournaments.length,
    rounds: allRounds.length,
    groups: allGroups.length,
    teams: allTeams.length,
    members: allMembers.length,
    matches: allMatches.length,
    completedMatches: allMatches.filter(
      (match) => match.status === MatchStatus.COMPLETED,
    ).length,
    ongoingMatches: allMatches.filter(
      (match) => match.status === MatchStatus.ONGOING,
    ).length,
    pendingMatches: allMatches.filter(
      (match) => match.status === MatchStatus.PENDING,
    ).length,
    draws: allMatches.filter((match) => match.outcome === MatchOutcome.DRAW)
      .length,
    byes: allMatches.filter((match) => match.isBye).length,
    teamStatuses: countBy(allTeams.map((team) => team.status)),
    tournamentStatuses: countBy(
      tournaments.map((tournament) => tournament.status),
    ),
    tournamentVisibility: countBy(
      tournaments.map((tournament) => tournament.visibility),
    ),
    tournamentModes: countBy(tournaments.map((tournament) => tournament.mode)),
    tournamentsByGame: countBy(
      tournaments.map((tournament) => tournament.game.name),
    ),
    roundsByFormat: countBy(allRounds.map((round) => round.format)),
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Seed validation failed: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
