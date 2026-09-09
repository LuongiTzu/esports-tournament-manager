import { Role, RoundFormat, TournamentStatus } from '@prisma/client';
import { GAME_CATALOG } from '../games/game-catalog';
import { TournamentTeamSizePolicy } from '../tournaments/domain/tournament-team-size.policy';
import {
  DEVELOPMENT_PASSWORD,
  SEED_TOURNAMENTS,
  SEED_USERS,
} from '../../prisma/seed/data';

const LEGACY_SETTING_KEYS = new Set([
  'doubleRound',
  'pointsWin',
  'pointsDraw',
  'pointsLoss',
  'numGroups',
  'teamsPerGroup',
  'numRounds',
  'advanceCount',
  'seeding',
]);

describe('development seed specification', () => {
  it('defines 150 varied Vietnamese development accounts', () => {
    expect(SEED_USERS).toHaveLength(150);
    expect(SEED_USERS.filter((user) => user.role === Role.ADMIN)).toHaveLength(
      3,
    );
    expect(
      SEED_USERS.filter((user) => user.persona === 'ORGANIZER'),
    ).toHaveLength(30);
    expect(SEED_USERS.filter((user) => user.persona === 'HYBRID')).toHaveLength(
      12,
    );
    expect(
      SEED_USERS.filter((user) => user.persona === 'PARTICIPANT'),
    ).toHaveLength(75);
    expect(
      SEED_USERS.filter((user) => user.persona === 'SPECTATOR'),
    ).toHaveLength(30);
    expect(SEED_USERS.filter((user) => user.isLocked)).toHaveLength(7);
    expect(
      SEED_USERS.filter((user) => user.isLocked && user.role === Role.ADMIN),
    ).toHaveLength(0);
    expect(new Set(SEED_USERS.map((user) => user.id)).size).toBe(150);
    expect(new Set(SEED_USERS.map((user) => user.email)).size).toBe(150);
    expect(DEVELOPMENT_PASSWORD).toBe('12345678');
  });

  it('defines the requested tournament and game distribution', () => {
    expect(SEED_TOURNAMENTS).toHaveLength(80);
    const byGame = Object.fromEntries(
      GAME_CATALOG.map((game) => [
        game.code,
        SEED_TOURNAMENTS.filter(
          (tournament) => tournament.gameCode === game.code,
        ).length,
      ]),
    );
    expect(byGame.LIEN_QUAN_MOBILE).toBe(17);
    expect(byGame.LEAGUE_OF_LEGENDS).toBe(15);
    expect(byGame.TEKKEN_8).toBe(3);
    expect(byGame.ROCKET_LEAGUE).toBe(3);
    expect(Object.values(byGame).reduce((sum, count) => sum + count, 0)).toBe(
      80,
    );
  });

  it('spreads coherent lifecycle states from early August to mid September', () => {
    const statusCount = (status: TournamentStatus) =>
      SEED_TOURNAMENTS.filter((tournament) => tournament.status === status)
        .length;
    expect(statusCount(TournamentStatus.COMPLETED)).toBe(30);
    expect(statusCount(TournamentStatus.ONGOING)).toBe(20);
    expect(statusCount(TournamentStatus.REGISTRATION)).toBe(18);
    expect(statusCount(TournamentStatus.DRAFT)).toBe(8);
    expect(statusCount(TournamentStatus.CANCELLED)).toBe(4);
    const starts = SEED_TOURNAMENTS.map(
      (tournament) => new Date(tournament.startDate),
    );
    expect(
      new Date(Math.min(...starts.map(Number))).toISOString().slice(0, 10),
    ).toBe('2026-08-01');
    expect(
      new Date(Math.max(...starts.map(Number))).toISOString().slice(0, 10),
    ).toBe('2026-09-15');
    for (const tournament of SEED_TOURNAMENTS) {
      expect(new Date(tournament.registrationStartDate).getTime()).toBeLessThan(
        new Date(tournament.registrationDeadline).getTime(),
      );
      expect(new Date(tournament.registrationDeadline).getTime()).toBeLessThan(
        new Date(tournament.startDate).getTime(),
      );
      expect(new Date(tournament.startDate).getTime()).toBeLessThan(
        new Date(tournament.endDate).getTime(),
      );
    }
  });

  it('uses 90 percent threshold Swiss and 90 percent double elimination without reset', () => {
    const swissRounds = SEED_TOURNAMENTS.flatMap(
      (tournament) => tournament.rounds,
    ).filter((round) => round.format === RoundFormat.SWISS);
    const doubleRounds = SEED_TOURNAMENTS.flatMap(
      (tournament) => tournament.rounds,
    ).filter((round) => round.format === RoundFormat.DOUBLE_ELIM);
    expect(swissRounds).toHaveLength(30);
    expect(
      swissRounds.filter((round) => round.settings.mode === 'THRESHOLD'),
    ).toHaveLength(27);
    expect(doubleRounds).toHaveLength(20);
    expect(
      doubleRounds.filter((round) => !round.settings.grandFinalReset),
    ).toHaveLength(18);
  });

  it('uses valid roster snapshots and canonical round settings', () => {
    const games = new Map(GAME_CATALOG.map((game) => [game.code, game]));
    const policy = new TournamentTeamSizePolicy();
    const formats = new Set<RoundFormat>();
    for (const tournament of SEED_TOURNAMENTS) {
      const game = games.get(tournament.gameCode);
      expect(game).toBeDefined();
      if (!game) continue;
      const teamSize = policy.resolveTeamSize(game, tournament.teamSize);
      expect(
        policy.validateMaxTeamSize(game, teamSize, tournament.maxTeamSize),
      ).toBe(tournament.maxTeamSize);
      expect(
        tournament.approvedTeams + tournament.pendingTeams,
      ).toBeLessThanOrEqual(tournament.maxTeams);
      for (const round of tournament.rounds) {
        formats.add(round.format);
        expect(
          Object.keys(round.settings).some((key) =>
            LEGACY_SETTING_KEYS.has(key),
          ),
        ).toBe(false);
        if (
          round.format === RoundFormat.GROUP_STAGE &&
          tournament.competition !== 'NONE'
        ) {
          expect(tournament.approvedTeams % round.settings.numberOfGroups).toBe(
            0,
          );
          expect(round.settings.advancingTeamsPerGroup).toBeLessThan(
            tournament.approvedTeams / round.settings.numberOfGroups,
          );
        }
      }
    }
    expect(formats).toEqual(new Set(Object.values(RoundFormat)));
  });
});
