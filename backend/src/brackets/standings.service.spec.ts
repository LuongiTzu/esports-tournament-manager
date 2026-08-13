import { RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StandingsService } from './standings.service';
import { SwissService } from './swiss.service';

describe('StandingsService', () => {
  it('calculates and sorts basic standings by wins and score difference', async () => {
    const prisma = {
      team: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', name: 'A', seed: 2 },
          { id: 'b', name: 'B', seed: 1 },
        ]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            teamAId: 'a',
            teamBId: 'b',
            scoreA: 2,
            scoreB: 0,
            winnerTeamId: 'a',
            isBye: false,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new StandingsService(prisma, {} as SwissService);

    const result = await service.forTournament('t-1', [
      { id: 'r-1', format: RoundFormat.ROUND_ROBIN },
    ]);

    expect(result.rounds[0].standings).toEqual([
      expect.objectContaining({ id: 'a', wins: 1, scoreDifference: 2 }),
      expect.objectContaining({ id: 'b', losses: 1, scoreDifference: -2 }),
    ]);
  });

  it('delegates Swiss standings to SwissService', async () => {
    const swiss = {
      calculateSwissStandings: jest.fn().mockResolvedValue([{ teamId: 'a' }]),
    } as unknown as SwissService;
    const service = new StandingsService({} as PrismaService, swiss);

    const result = await service.forTournament('t-1', [
      { id: 'r-1', format: RoundFormat.SWISS },
    ]);

    expect(result.rounds[0].standings).toEqual([{ teamId: 'a' }]);
  });
});
