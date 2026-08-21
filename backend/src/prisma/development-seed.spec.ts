import { RoundFormat } from '@prisma/client';
import { GAME_CATALOG, GAME_CATALOG_NAMES } from '../games/game-catalog';
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
        ...new Set(SEED_TOURNAMENTS.map((tournament) => tournament.game)),
      ].sort(),
    ).toEqual([...GAME_CATALOG_NAMES].sort());
    expect(
      SEED_TOURNAMENTS.some((tournament) =>
        ['PUBG', 'FC Online', 'CS:GO'].includes(tournament.game),
      ),
    ).toBe(false);
  });

  it('uses roster snapshots within game bounds', () => {
    const games = new Map(GAME_CATALOG.map((game) => [game.name, game]));
    for (const tournament of SEED_TOURNAMENTS) {
      const game = games.get(tournament.game)!;
      expect(tournament.maxTeamSize).toBeGreaterThanOrEqual(
        game.defaultTeamSize,
      );
      expect(tournament.maxTeamSize).toBeLessThanOrEqual(game.maxTeamSize);
      expect(
        tournament.approvedTeams +
          tournament.pendingTeams +
          tournament.rejectedTeams,
      ).toBeLessThanOrEqual(tournament.maxTeams);
    }
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
