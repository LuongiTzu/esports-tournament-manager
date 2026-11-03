import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchYouTubeService } from './match-youtube.service';

function fixture(overrides: Record<string, unknown> = {}) {
  const record = {
    id: 'match-1',
    youtubeUrl: null,
    isBye: false,
    isActive: true,
    status: 'COMPLETED',
    scoreA: 2,
    scoreB: 0,
    winnerTeamId: 'team-a',
    round: {
      id: 'round-1',
      tournamentId: 'tournament-1',
      tournament: { status: 'COMPLETED' },
    },
    ...overrides,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn().mockResolvedValue(record),
      update: jest
        .fn()
        .mockImplementation(
          ({ data }: { data: { youtubeUrl: string | null } }) => ({
            ...record,
            ...data,
          }),
        ),
    },
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const events = { publish: jest.fn() };
  return {
    tx,
    events,
    service: new MatchYouTubeService(
      prisma as unknown as PrismaService,
      events,
    ),
  };
}

describe('Match YouTube updates', () => {
  it('only writes the video even on a completed match and only emits matchUpdated', async () => {
    const { tx, events, service } = fixture();
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    await expect(
      service.update('match-1', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
    ).resolves.toEqual({ id: 'match-1', youtubeUrl });
    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { youtubeUrl },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith({
      tournamentId: 'tournament-1',
      event: 'matchUpdated',
      payload: expect.objectContaining({
        youtubeUrl,
        status: 'COMPLETED',
        scoreA: 2,
        scoreB: 0,
        winnerTeamId: 'team-a',
      }) as unknown,
    });
  });
  it('removes the link with null', async () => {
    const { service } = fixture({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    await expect(
      service.update('match-1', { youtubeUrl: null }),
    ).resolves.toEqual({ id: 'match-1', youtubeUrl: null });
  });
  it('does not write or broadcast when the link is unchanged', async () => {
    const { service, tx, events } = fixture();
    await service.update('match-1', { youtubeUrl: null });
    expect(tx.match.update).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
  it.each([
    { isBye: true },
    { isActive: false },
    {
      round: {
        id: 'round-1',
        tournamentId: 'tournament-1',
        tournament: { status: 'CANCELLED' },
      },
    },
  ])('rejects a locked match: %o', async (overrides) => {
    const { service, tx, events } = fixture(overrides);
    await expect(
      service.update('match-1', { youtubeUrl: null }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.match.update).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
  it('rechecks deletion after acquiring locks', async () => {
    const { service, tx } = fixture();
    tx.match.findUnique
      .mockResolvedValueOnce({ round: { id: 'r', tournamentId: 't' } })
      .mockResolvedValueOnce(null);
    await expect(
      service.update('match-1', { youtubeUrl: null }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.match.update).not.toHaveBeenCalled();
  });
  it('rejects invalid links before starting a write', async () => {
    const { service, tx } = fixture();
    await expect(
      service.update('match-1', { youtubeUrl: 'https://evil.test' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.match.findUnique).not.toHaveBeenCalled();
  });
  it('does not broadcast failed writes', async () => {
    const { service, tx, events } = fixture();
    tx.match.update.mockRejectedValue(new Error('database unavailable'));
    await expect(
      service.update('match-1', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
    ).rejects.toThrow('database unavailable');
    expect(events.publish).not.toHaveBeenCalled();
  });
});
