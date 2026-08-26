import { GamePositionMode, Gender, MemberRole } from '@prisma/client';
import { RegistrationMemberInput } from '../types/registration-member-input';
import { RegistrationRules } from '../types/registration-rules';
import {
  isActivePlayerRole,
  isPlayerRosterRole,
  RegistrationRosterPolicy,
} from './registration-roster.policy';

function rules(overrides: Partial<RegistrationRules> = {}): RegistrationRules {
  return {
    tournamentId: 'tournament-1',
    minTeamSize: 1,
    maxTeamSize: 1,
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

function member(
  index: number,
  memberRole: MemberRole,
  position?: string,
): RegistrationMemberInput {
  return {
    realName: `Member ${index}`,
    ign: `member-${index}`,
    memberRole,
    position,
  };
}

function activeRoster(size: number): RegistrationMemberInput[] {
  return Array.from({ length: size }, (_, index) =>
    member(index, index === 0 ? MemberRole.CAPTAIN : MemberRole.PLAYER),
  );
}

describe('RegistrationRosterPolicy', () => {
  const policy = new RegistrationRosterPolicy();

  it('classifies active, substitute and staff roles canonically', () => {
    expect(isActivePlayerRole(MemberRole.CAPTAIN)).toBe(true);
    expect(isActivePlayerRole(MemberRole.PLAYER)).toBe(true);
    expect(isActivePlayerRole(MemberRole.SUBSTITUTE)).toBe(false);
    expect(isPlayerRosterRole(MemberRole.SUBSTITUTE)).toBe(true);
    expect(isPlayerRosterRole(MemberRole.COACH)).toBe(false);
    expect(isPlayerRosterRole(MemberRole.MANAGER)).toBe(false);
  });

  it('accepts a 1v1 roster containing only one captain', () => {
    expect(policy.validate(rules(), [member(0, MemberRole.CAPTAIN)])).toEqual({
      captainIndex: 0,
      errors: [],
    });
  });

  it('rejects two active players for a 1v1 snapshot', () => {
    const result = policy.validate(rules({ maxTeamSize: 2 }), activeRoster(2));
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'members' })]),
    );
  });

  it('requires exactly one explicit captain', () => {
    const missing = policy.validate(rules(), [member(0, MemberRole.PLAYER)]);
    const duplicate = policy.validate(
      rules({ minTeamSize: 2, maxTeamSize: 2 }),
      [member(0, MemberRole.CAPTAIN), member(1, MemberRole.CAPTAIN)],
    );

    expect(missing.captainIndex).toBe(-1);
    expect(missing.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'memberRole', memberIndex: null }),
      ]),
    );
    expect(duplicate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'memberRole', memberIndex: 1 }),
      ]),
    );
  });

  it('requires the active count to equal the tournament snapshot', () => {
    expect(
      policy.validate(
        rules({ minTeamSize: 5, maxTeamSize: 7 }),
        activeRoster(5),
      ).errors,
    ).toEqual([]);
    expect(
      policy.validate(
        rules({ minTeamSize: 5, maxTeamSize: 7 }),
        activeRoster(6),
      ).errors,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'members' })]),
    );
  });

  it('derives substitute capacity from max minus min', () => {
    const valid = [
      ...activeRoster(5),
      member(5, MemberRole.SUBSTITUTE),
      member(6, MemberRole.SUBSTITUTE),
    ];
    const excessive = [...valid, member(7, MemberRole.SUBSTITUTE)];

    expect(
      policy.validate(rules({ minTeamSize: 5, maxTeamSize: 7 }), valid).errors,
    ).toEqual([]);
    expect(
      policy.validate(rules({ minTeamSize: 5, maxTeamSize: 7 }), excessive)
        .errors,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'members' })]),
    );
  });

  it('does not count coach or manager toward active or player roster size', () => {
    const roster = [
      ...activeRoster(1),
      member(1, MemberRole.COACH),
      member(2, MemberRole.MANAGER),
    ];
    expect(policy.validate(rules(), roster).errors).toEqual([]);
  });

  describe('FIXED positions', () => {
    const fixedRules = rules({
      minTeamSize: 3,
      maxTeamSize: 5,
      positions: ['TOP', 'MID', 'SUPPORT'],
      positionMode: GamePositionMode.FIXED,
    });
    const exact = [
      member(0, MemberRole.CAPTAIN, 'TOP'),
      member(1, MemberRole.PLAYER, 'MID'),
      member(2, MemberRole.PLAYER, 'SUPPORT'),
    ];

    it('accepts exact active position coverage', () => {
      expect(policy.validate(fixedRules, exact).errors).toEqual([]);
    });

    it.each([
      ['missing', [...exact.slice(0, 2), member(2, MemberRole.PLAYER)]],
      ['duplicate', [exact[0], member(1, MemberRole.PLAYER, 'TOP'), exact[2]]],
      [
        'unknown',
        [exact[0], exact[1], member(2, MemberRole.PLAYER, 'UNKNOWN')],
      ],
    ])('rejects %s active coverage', (_, roster) => {
      expect(policy.validate(fixedRules, roster).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'position' }),
        ]),
      );
    });

    it('allows substitutes to omit or duplicate valid positions', () => {
      const roster = [
        ...exact,
        member(3, MemberRole.SUBSTITUTE),
        member(4, MemberRole.SUBSTITUTE, 'TOP'),
      ];
      expect(policy.validate(fixedRules, roster).errors).toEqual([]);
    });

    it('does not require a substitute position when full profiles are required', () => {
      const withProfiles = [...exact, member(3, MemberRole.SUBSTITUTE)].map(
        (item) => ({
          ...item,
          birthDate: '2000-01-01',
          gender: Gender.OTHER,
        }),
      );
      expect(
        policy.validate(
          { ...fixedRules, maxTeamSize: 4, requireMemberFullInfo: true },
          withProfiles,
        ).errors,
      ).toEqual([]);
    });

    it('allows two substitutes to share a valid position', () => {
      const roster = [
        ...exact,
        member(3, MemberRole.SUBSTITUTE, 'MID'),
        member(4, MemberRole.SUBSTITUTE, 'MID'),
      ];
      expect(policy.validate(fixedRules, roster).errors).toEqual([]);
    });

    it('rejects an unknown substitute and never uses a substitute for coverage', () => {
      const roster = [
        exact[0],
        exact[1],
        member(2, MemberRole.PLAYER),
        member(3, MemberRole.SUBSTITUTE, 'SUPPORT'),
        member(4, MemberRole.SUBSTITUTE, 'UNKNOWN'),
      ];
      const positionErrors = policy
        .validate(fixedRules, roster)
        .errors.filter((error) => error.field === 'position');
      expect(positionErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ memberIndex: 2 }),
          expect.objectContaining({ memberIndex: 4 }),
          expect.objectContaining({ memberIndex: null }),
        ]),
      );
    });
  });

  describe('OPTIONAL positions', () => {
    const optionalRules = rules({
      minTeamSize: 5,
      maxTeamSize: 6,
      positions: ['ORDER', 'ATTACKER', 'SNIPER', 'TACTICAL_BACKUP'],
      positionMode: GamePositionMode.OPTIONAL,
    });

    it('allows omitted and duplicate tactical positions', () => {
      const roster: RegistrationMemberInput[] = activeRoster(5).map(
        (item, index) => ({
          ...item,
          position: index === 0 ? undefined : index < 3 ? 'ATTACKER' : 'SNIPER',
        }),
      );
      roster.push(member(5, MemberRole.SUBSTITUTE, 'ATTACKER'));
      expect(policy.validate(optionalRules, roster).errors).toEqual([]);
    });

    it('rejects an unknown optional position', () => {
      const roster = activeRoster(5);
      roster[1].position = 'UNKNOWN';
      expect(policy.validate(optionalRules, roster).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'position' }),
        ]),
      );
    });
  });

  it('accepts no positions and rejects supplied positions for NONE games', () => {
    expect(policy.validate(rules(), activeRoster(1)).errors).toEqual([]);
    expect(
      policy.validate(rules(), [
        { ...member(0, MemberRole.CAPTAIN), position: 'PLAYER_1' },
      ]).errors,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'position' })]),
    );
  });

  it('preserves in-roster IGN and in-game ID duplicate validation', () => {
    const result = policy.validate(rules({ minTeamSize: 2, maxTeamSize: 2 }), [
      { ...member(0, MemberRole.CAPTAIN), ign: 'Same', inGameId: 'ID-1' },
      { ...member(1, MemberRole.PLAYER), ign: 'same', inGameId: 'id-1' },
    ]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'ign', memberIndex: 1 }),
        expect.objectContaining({ field: 'inGameId', memberIndex: 1 }),
      ]),
    );
  });
});
