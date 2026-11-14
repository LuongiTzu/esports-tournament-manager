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

  it('builds rules from tournament snapshots and normalized game positions', () => {
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        errors: expect.any(Array),
      }),
      status: 422,
    });
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
});
