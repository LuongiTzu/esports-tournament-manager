import { GamePositionMode, Gender, MemberRole } from '@prisma/client';
import { RegistrationRules } from '../types/registration-rules';
import { RegistrationRosterPolicy } from './registration-roster.policy';

function rules(overrides: Partial<RegistrationRules> = {}): RegistrationRules {
  return {
    tournamentId: 'tournament-1',
    minTeamSize: 1,
    maxTeamSize: 2,
    maxSubstitutes: 1,
    minAge: null,
    maxAge: null,
    allowedGenders: null,
    requireMemberFullInfo: false,
    startDate: new Date('2030-01-01T00:00:00.000Z'),
    positions: [],
    positionMode: GamePositionMode.NONE,
    ...overrides,
  };
}

describe('RegistrationRosterPolicy', () => {
  const policy = new RegistrationRosterPolicy();

  it('enforces playing roster size and substitute limits', () => {
    const result = policy.validate(rules({ minTeamSize: 2 }), [
      { realName: 'One', ign: 'one', memberRole: MemberRole.CAPTAIN },
      { realName: 'Sub A', ign: 'sub-a', memberRole: MemberRole.SUBSTITUTE },
      { realName: 'Sub B', ign: 'sub-b', memberRole: MemberRole.SUBSTITUTE },
    ]);
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['members']),
    );
  });

  it('rejects more than one captain and in-roster duplicate identities', () => {
    const result = policy.validate(rules(), [
      { realName: 'One', ign: 'same', memberRole: MemberRole.CAPTAIN },
      {
        realName: 'Two',
        ign: 'same',
        memberRole: MemberRole.CAPTAIN,
      },
    ]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'memberRole', memberIndex: 1 }),
        expect.objectContaining({ field: 'ign', memberIndex: 1 }),
      ]),
    );
  });

  it('enforces required profile, age, gender and stable position codes', () => {
    const result = policy.validate(
      rules({
        minAge: 18,
        allowedGenders: [Gender.FEMALE],
        requireMemberFullInfo: true,
        positions: ['MID'],
        positionMode: GamePositionMode.FIXED,
      }),
      [
        {
          realName: '',
          ign: 'player',
          birthDate: '2015-01-01',
          gender: Gender.MALE,
          position: 'UNKNOWN',
          memberRole: MemberRole.CAPTAIN,
        },
      ],
    );
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['realName', 'birthDate', 'gender', 'position']),
    );
  });

  it('resolves the first member as captain when no CAPTAIN is submitted', () => {
    expect(
      policy.validate(rules(), [{ realName: 'One', ign: 'one' }]).captainIndex,
    ).toBe(0);
  });
});
