import { RoundFormat } from '@prisma/client';
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
  it('defines the intended deterministic user personas and credentials', () => {
    expect(SEED_USERS).toHaveLength(30);
    expect(SEED_USERS.filter((user) => user.persona === 'ADMIN')).toHaveLength(
      2,
    );
    expect(
      SEED_USERS.filter((user) => user.persona === 'ORGANIZER'),
    ).toHaveLength(8);
    expect(
      SEED_USERS.filter((user) => user.persona === 'PARTICIPANT'),
    ).toHaveLength(20);
    expect(new Set(SEED_USERS.map((user) => user.id)).size).toBe(30);
    expect(new Set(SEED_USERS.map((user) => user.email)).size).toBe(30);
    expect(DEVELOPMENT_PASSWORD).toBe('12345678');
  });

  it('represents every approved game and no deprecated game', () => {
    expect(SEED_TOURNAMENTS).toHaveLength(20);
    expect(
      [
        ...new Set(SEED_TOURNAMENTS.map((tournament) => tournament.gameCode)),
      ].sort(),
    ).toEqual(GAME_CATALOG.map((game) => game.code).sort());
    expect(
      SEED_TOURNAMENTS.some((tournament) =>
        ['PUBG', 'CS_GO'].includes(tournament.gameCode),
      ),
    ).toBe(false);
  });

  it('uses roster snapshots within game bounds', () => {
    const games = new Map(GAME_CATALOG.map((game) => [game.code, game]));
    const policy = new TournamentTeamSizePolicy();
    for (const tournament of SEED_TOURNAMENTS) {
      const game = games.get(tournament.gameCode);
      expect(game).toBeDefined();
      if (!game) throw new Error(`Unknown game ${tournament.gameCode}`);
      const teamSize = policy.resolveTeamSize(game, tournament.teamSize);
      expect(
        policy.validateMaxTeamSize(game, teamSize, tournament.maxTeamSize),
      ).toBe(tournament.maxTeamSize);
      expect(
        tournament.gameCode === 'CUSTOM'
          ? Boolean(tournament.customGameName?.trim())
          : tournament.customGameName === undefined,
      ).toBe(true);
      expect(tournament.maxTeamSize).toBeGreaterThanOrEqual(teamSize);
      expect(tournament.maxTeamSize).toBeLessThanOrEqual(game.maxTeamSize);
      expect(
        tournament.approvedTeams +
          tournament.pendingTeams +
          tournament.rejectedTeams,
      ).toBeLessThanOrEqual(tournament.maxTeams);
    }
  });

  it('includes representative PRESET and FLEXIBLE snapshots', () => {
    expect(
      SEED_TOURNAMENTS.filter(
        (tournament) => tournament.gameCode === 'FC_ONLINE',
      ).map((tournament) => [tournament.teamSize, tournament.maxTeamSize]),
    ).toEqual(
      expect.arrayContaining([
        [1, 1],
        [3, 4],
      ]),
    );
    expect(
      SEED_TOURNAMENTS.filter(
        (tournament) => tournament.gameCode === 'CUSTOM',
      ).map((tournament) => [
        tournament.customGameName,
        tournament.teamSize,
        tournament.maxTeamSize,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['Chess', 1, 1],
        ['Custom Arena', 5, 7],
      ]),
    );
  });

  it('uses canonical settings and valid equal-group configurations', () => {
    const formats = new Set<RoundFormat>();
    for (const tournament of SEED_TOURNAMENTS) {
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
