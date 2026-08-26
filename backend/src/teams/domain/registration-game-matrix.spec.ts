import { GamePositionMode, MemberRole } from '@prisma/client';
import { GAME_CATALOG, GameCatalogEntry } from '../../games/game-catalog';
import { RegistrationMemberInput } from '../types/registration-member-input';
import { RegistrationRules } from '../types/registration-rules';
import { RegistrationRosterPolicy } from './registration-roster.policy';

const policy = new RegistrationRosterPolicy();

function game(code: string): GameCatalogEntry {
  const entry = GAME_CATALOG.find((candidate) => candidate.code === code);
  if (!entry) throw new Error(`Missing catalog game ${code}`);
  return entry;
}

function rules(
  entry: GameCatalogEntry,
  minTeamSize = entry.defaultTeamSize,
  maxTeamSize = entry.maxTeamSize,
): RegistrationRules {
  return {
    tournamentId: `tournament-${entry.code}`,
    minTeamSize,
    maxTeamSize,
    minAge: null,
    maxAge: null,
    allowedGenders: null,
    requireMemberFullInfo: false,
    startDate: null,
    positions: entry.positions,
    positionMode: entry.positionMode,
  };
}

function roster(
  size: number,
  positions: readonly string[] = [],
): RegistrationMemberInput[] {
  return Array.from({ length: size }, (_, index) => ({
    realName: `Player ${index + 1}`,
    ign: `player-${index + 1}`,
    memberRole: index === 0 ? MemberRole.CAPTAIN : MemberRole.PLAYER,
    position: positions[index],
  }));
}

function expectValid(
  entry: GameCatalogEntry,
  minTeamSize = entry.defaultTeamSize,
  maxTeamSize = entry.maxTeamSize,
  positions: readonly string[] = entry.positionMode === GamePositionMode.FIXED
    ? entry.positions
    : [],
): void {
  expect(
    policy.validate(
      rules(entry, minTeamSize, maxTeamSize),
      roster(minTeamSize, positions),
    ).errors,
  ).toEqual([]);
}

describe('canonical game registration matrix', () => {
  it('keeps every FIXED catalog position set aligned with its active size', () => {
    for (const entry of GAME_CATALOG.filter(
      (candidate) => candidate.positionMode === GamePositionMode.FIXED,
    )) {
      expect({ code: entry.code, positions: entry.positions.length }).toEqual({
        code: entry.code,
        positions: entry.defaultTeamSize,
      });
    }
  });

  it.each([
    'LIEN_QUAN_MOBILE',
    'LEAGUE_OF_LEGENDS',
    'VALORANT',
    'COUNTER_STRIKE_2',
    'DOTA_2',
    'ROCKET_LEAGUE',
    'TEKKEN_8',
    'STREET_FIGHTER_6',
  ])('preserves the existing %s roster semantics', (code) => {
    expectValid(game(code));
  });

  it.each(['MLBB', 'HONOR_OF_KINGS', 'WILD_RIFT'])(
    'accepts exact FIXED active coverage for %s',
    (code) => {
      const entry = game(code);
      expect(entry.positionMode).toBe(GamePositionMode.FIXED);
      expectValid(entry);
    },
  );

  it('accepts an MLBB substitute duplicating an active position', () => {
    const entry = game('MLBB');
    const members = roster(5, entry.positions);
    members.push({
      realName: 'Substitute',
      ign: 'substitute',
      memberRole: MemberRole.SUBSTITUTE,
      position: 'JUNGLE',
    });
    expect(policy.validate(rules(entry, 5, 7), members).errors).toEqual([]);
  });

  it('accepts duplicate CrossFire tactical positions', () => {
    const entry = game('CROSSFIRE_PC');
    expect(entry.positionMode).toBe(GamePositionMode.OPTIONAL);
    expect(
      policy.validate(
        rules(entry, 5, 6),
        roster(5, ['ATTACKER', 'ATTACKER', 'SNIPER']),
      ).errors,
    ).toEqual([]);
  });

  it('keeps Pokemon UNITE free of player positions', () => {
    const entry = game('POKEMON_UNITE');
    expect(entry.positions).toEqual([]);
    expect(entry.positionMode).toBe(GamePositionMode.NONE);
    expectValid(entry);
  });

  it.each([
    [1, 1],
    [3, 4],
  ])('supports FC Online snapshot %i/%i', (minTeamSize, maxTeamSize) => {
    expectValid(game('FC_ONLINE'), minTeamSize, maxTeamSize);
  });

  it.each([
    [1, 1],
    [5, 7],
    [20, 30],
  ])('supports Custom snapshot %i/%i', (minTeamSize, maxTeamSize) => {
    expectValid(game('CUSTOM'), minTeamSize, maxTeamSize);
  });
});
