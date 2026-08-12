import { BadRequestException } from '@nestjs/common';
import { MatchStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import { SwissService } from './swiss.service';

describe('SwissService', () => {
  it('blocks next-round generation while the current round is incomplete', async () => {
    const tx = {
      round: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'round-1',
          format: RoundFormat.SWISS,
          settings: { numRounds: 3 },
          bestOf: 1,
          tournamentId: 'tournament-1',
        }),
      },
      team: { findMany: jest.fn().mockResolvedValue([]) },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            teamAId: 'team-1',
            teamBId: 'team-2',
            scoreA: 0,
            scoreB: 0,
            bracketRound: 1,
            isBye: false,
            status: MatchStatus.PENDING,
          },
        ]),
        createMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new SwissService(
      prisma,
      new RoundSettingsService(),
      new SwissGenerator(),
    );

    await expect(
      service.generateNextSwissRound('round-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.match.createMany).not.toHaveBeenCalled();
  });
});
