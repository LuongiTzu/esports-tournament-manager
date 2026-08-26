import { TeamSizeMode } from '@prisma/client';
import {
  TournamentGameSizeRules,
  TournamentTeamSizePolicy,
  TournamentTeamSizeRuleError,
} from './tournament-team-size.policy';

const policy = new TournamentTeamSizePolicy();

function rules(
  overrides: Partial<TournamentGameSizeRules> = {},
): TournamentGameSizeRules {
  return {
    teamSizeMode: TeamSizeMode.FIXED,
    defaultTeamSize: 5,
    maxTeamSize: 7,
    allowedTeamSizes: [],
    minSelectableTeamSize: null,
    maxSelectableTeamSize: null,
    ...overrides,
  };
}

describe('TournamentTeamSizePolicy team-size selection', () => {
  it('uses the default for FIXED and accepts the exact value', () => {
    expect(policy.resolveTeamSize(rules())).toBe(5);
    expect(policy.resolveTeamSize(rules(), 5)).toBe(5);
  });

  it.each([4, 6])('rejects FIXED size %i', (teamSize) => {
    expect(() => policy.resolveTeamSize(rules(), teamSize)).toThrow(
      TournamentTeamSizeRuleError,
    );
  });

  const preset = rules({
    teamSizeMode: TeamSizeMode.PRESET,
    defaultTeamSize: 3,
    maxTeamSize: 4,
    allowedTeamSizes: [1, 3],
  });

  it('uses the PRESET default and accepts every allowed size', () => {
    expect(policy.resolveTeamSize(preset)).toBe(3);
    expect(policy.resolveTeamSize(preset, 1)).toBe(1);
    expect(policy.resolveTeamSize(preset, 3)).toBe(3);
  });

  it('rejects a size outside PRESET metadata', () => {
    expect(() => policy.resolveTeamSize(preset, 2)).toThrow(
      TournamentTeamSizeRuleError,
    );
  });

  const flexible = rules({
    teamSizeMode: TeamSizeMode.FLEXIBLE,
    defaultTeamSize: 1,
    maxTeamSize: 30,
    minSelectableTeamSize: 1,
    maxSelectableTeamSize: 20,
  });

  it.each([undefined, 1, 5, 20])('accepts FLEXIBLE size %s', (teamSize) => {
    expect(policy.resolveTeamSize(flexible, teamSize)).toBe(teamSize ?? 1);
  });

  it.each([0, 21])('rejects FLEXIBLE size %i', (teamSize) => {
    expect(() => policy.resolveTeamSize(flexible, teamSize)).toThrow(
      TournamentTeamSizeRuleError,
    );
  });
});

describe('TournamentTeamSizePolicy maximum roster selection', () => {
  it('defaults FIXED max to the Game roster cap', () => {
    expect(policy.resolveMaxTeamSize(rules(), 5)).toBe(7);
  });

  it.each([TeamSizeMode.PRESET, TeamSizeMode.FLEXIBLE])(
    'defaults %s max to the selected active size',
    (teamSizeMode) => {
      expect(
        policy.resolveMaxTeamSize(rules({ teamSizeMode, maxTeamSize: 30 }), 3),
      ).toBe(3);
    },
  );

  it('accepts an explicit max inside active-size and Game bounds', () => {
    expect(policy.resolveMaxTeamSize(rules(), 5, 6)).toBe(6);
  });

  it('rejects an explicit max below the active size', () => {
    expect(() => policy.resolveMaxTeamSize(rules(), 5, 4)).toThrow(
      TournamentTeamSizeRuleError,
    );
  });

  it('rejects an explicit max above the Game roster cap', () => {
    expect(() => policy.resolveMaxTeamSize(rules(), 5, 8)).toThrow(
      TournamentTeamSizeRuleError,
    );
  });
});
