import { GamePositionMode, Gender, MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegistrationRules,
  RegistrationValidatorService,
} from './registration-validator.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';

function rules(overrides: Partial<RegistrationRules> = {}): RegistrationRules {
  return {
    tournamentId: 't-1',
    minTeamSize: 1,
    maxTeamSize: 1,
    maxSubstitutes: 0,
    minAge: null,
    maxAge: null,
    allowedGenders: null,
    requireMemberFullInfo: false,
    startDate: null,
    positions: [],
    positionMode: GamePositionMode.NONE,
    ...overrides,
  };
}

function players(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    realName: `Player ${index + 1}`,
    ign: `player-${index + 1}`,
    memberRole: index === 0 ? MemberRole.CAPTAIN : MemberRole.PLAYER,
  }));
}

describe('RegistrationValidatorService', () => {
  const prisma = {
    teamMember: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const service = new RegistrationValidatorService(prisma);

  it('builds rules from the tournament snapshot and derives substitutes', () => {
    expect(
      service.buildRules({
        id: 't-1',
        minTeamSize: 1,
        maxTeamSize: 2,
        minAge: null,
        maxAge: null,
        allowedGenders: [Gender.MALE],
        requireMemberFullInfo: false,
        startDate: null,
        game: {
          positions: ['MID'],
          positionMode: GamePositionMode.FIXED,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        minTeamSize: 1,
        maxTeamSize: 2,
        maxSubstitutes: 1,
        allowedGenders: [Gender.MALE],
        positions: ['MID'],
        positionMode: GamePositionMode.FIXED,
      }),
    );
  });

  it('accepts a valid roster and resolves the captain', async () => {
    await expect(
      service.validate(
        {
          tournamentId: 't-1',
          minTeamSize: 1,
          maxTeamSize: 2,
          maxSubstitutes: 1,
          minAge: null,
          maxAge: null,
          allowedGenders: null,
          requireMemberFullInfo: false,
          startDate: null,
          positions: [],
          positionMode: GamePositionMode.NONE,
        },
        [
          {
            realName: 'Player One',
            ign: 'player1',
            email: 'player@example.com',
            memberRole: MemberRole.CAPTAIN,
          },
        ],
      ),
    ).resolves.toEqual({ captainIndex: 0 });
  });

  it('returns structured errors for invalid rosters', async () => {
    await expect(
      service.validate(
        {
          tournamentId: 't-1',
          minTeamSize: 2,
          maxTeamSize: 5,
          maxSubstitutes: 0,
          minAge: null,
          maxAge: null,
          allowedGenders: null,
          requireMemberFullInfo: false,
          startDate: null,
          positions: [],
          positionMode: GamePositionMode.NONE,
        },
        [{ realName: 'Player', ign: 'same' }],
      ),
    ).rejects.toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      response: expect.objectContaining({
        code: ApplicationErrorCode.REGISTRATION_INVALID,
        errors: expect.any(Array),
      }),
      status: 422,
    });
  });

  it.each([5, 6, 7])('accepts %i players for a 5-7 roster', async (count) => {
    await expect(
      service.validate(
        rules({ minTeamSize: 5, maxTeamSize: 7, maxSubstitutes: 2 }),
        players(count),
      ),
    ).resolves.toEqual({ captainIndex: 0 });
  });

  it.each([4, 8])('rejects %i players for a 5-7 roster', async (count) => {
    await expect(
      service.validate(
        rules({ minTeamSize: 5, maxTeamSize: 7, maxSubstitutes: 2 }),
        players(count),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('does not count coach or manager records as player roster slots', async () => {
    const members = [
      ...players(5),
      { realName: 'Coach', ign: 'coach', memberRole: MemberRole.COACH },
      { realName: 'Manager', ign: 'manager', memberRole: MemberRole.MANAGER },
    ];

    await expect(
      service.validate(rules({ minTeamSize: 5, maxTeamSize: 5 }), members),
    ).resolves.toEqual({ captainIndex: 0 });
  });

  it('accepts a member without email and phone', async () => {
    await expect(service.validate(rules(), players(1))).resolves.toEqual({
      captainIndex: 0,
    });
  });

  it.each([
    ['email only', { email: 'player@example.com' }],
    ['phone only', { phoneNumber: '0900000000' }],
  ])('accepts a member with %s', async (_, contact) => {
    await expect(
      service.validate(rules(), [{ ...players(1)[0], ...contact }]),
    ).resolves.toEqual({ captainIndex: 0 });
  });

  it('requires an allowed position for FIXED games with full info', async () => {
    const fixedRules = rules({
      requireMemberFullInfo: true,
      positions: ['TOP', 'JUNGLE'],
      positionMode: GamePositionMode.FIXED,
    });
    const fullMember = {
      ...players(1)[0],
      birthDate: '2000-01-01',
      gender: Gender.OTHER,
    };

    await expect(
      service.validate(fixedRules, [{ ...fullMember, position: 'JUNGLE' }]),
    ).resolves.toEqual({ captainIndex: 0 });
    await expect(
      service.validate(fixedRules, [fullMember]),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      service.validate(fixedRules, [{ ...fullMember, position: 'UNKNOWN' }]),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('keeps positions optional but validates supplied codes for OPTIONAL games', async () => {
    const optionalRules = rules({
      requireMemberFullInfo: true,
      positions: ['DUELIST', 'SENTINEL'],
      positionMode: GamePositionMode.OPTIONAL,
    });
    const fullMember = {
      ...players(1)[0],
      birthDate: '2000-01-01',
      gender: Gender.OTHER,
    };

    await expect(
      service.validate(optionalRules, [fullMember]),
    ).resolves.toEqual({
      captainIndex: 0,
    });
    await expect(
      service.validate(optionalRules, [{ ...fullMember, position: 'DUELIST' }]),
    ).resolves.toEqual({ captainIndex: 0 });
    await expect(
      service.validate(optionalRules, [{ ...fullMember, position: 'UNKNOWN' }]),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('accepts no position and rejects a submitted position for NONE games', async () => {
    await expect(service.validate(rules(), players(1))).resolves.toEqual({
      captainIndex: 0,
    });
    await expect(
      service.validate(rules(), [{ ...players(1)[0], position: 'LURKER' }]),
    ).rejects.toMatchObject({ status: 422 });
  });
});
