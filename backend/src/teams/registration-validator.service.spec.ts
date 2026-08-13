import { Gender, MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationValidatorService } from './registration-validator.service';

describe('RegistrationValidatorService', () => {
  const prisma = {
    teamMember: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const service = new RegistrationValidatorService(prisma);

  it('builds tournament rules with game size fallbacks', () => {
    expect(
      service.buildRules({
        id: 't-1',
        minTeamSize: null,
        maxTeamSize: null,
        maxSubstitutes: 1,
        minAge: null,
        maxAge: null,
        allowedGenders: [Gender.MALE],
        requireMemberFullInfo: false,
        startDate: null,
        game: { minTeamSize: 1, maxTeamSize: 2, positions: ['MID'] },
      }),
    ).toEqual(
      expect.objectContaining({
        minTeamSize: 1,
        maxTeamSize: 2,
        allowedGenders: [Gender.MALE],
        positions: ['MID'],
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
        },
        [{ realName: 'Player', ign: 'same' }],
      ),
    ).rejects.toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      response: expect.objectContaining({ errors: expect.any(Array) }),
      status: 422,
    });
  });
});
