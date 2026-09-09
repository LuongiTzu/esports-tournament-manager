import { BracketOperationsService } from './bracket-operations.service';
import { RoundSettingsService } from './round-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { BracketsService } from './brackets.service';
import { StandingsService } from './standings.service';
import { RoundFormat, RoundStatus, TournamentStatus } from '@prisma/client';

function harness() {
  const round = {
    id: 'r1',
    tournamentId: 't1',
    format: RoundFormat.DOUBLE_ELIM as RoundFormat,
    bestOf: 3,
    settings: { grandFinalReset: true },
    status: RoundStatus.UPCOMING as RoundStatus,
    tournament: { status: TournamentStatus.REGISTRATION as TournamentStatus },
    _count: { matches: 0, groups: 0, advancedTeams: 0 },
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    round: {
      findUnique: jest.fn().mockResolvedValue(round),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((run: (value: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;
  const events = { publish: jest.fn() };
  const service = new BracketOperationsService(
    prisma,
    {} as BracketsService,
    {} as StandingsService,
    new RoundSettingsService(),
    events,
  );
  return { round, tx, events, service };
}

describe('round settings updates', () => {
  it.each([true, false])(
    'persists reset=%s before generation',
    async (enabled) => {
      const { service, tx, events } = harness();
      await expect(
        service.updateSettings('r1', { grandFinalReset: enabled }),
      ).resolves.toMatchObject({ settings: { grandFinalReset: enabled } });
      expect(tx.round.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            settings: { scoringMode: 'SERIES_SCORE', grandFinalReset: enabled },
          },
        }),
      );
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentId: 't1',
          event: 'standingsUpdated',
        }),
      );
    },
  );

  it.each(['matches', 'groups', 'advancedTeams'] as const)(
    'locks settings when %s exist',
    async (dependency) => {
      const { service, round, tx } = harness();
      round._count[dependency] = 1;
      await expect(
        service.updateSettings('r1', { grandFinalReset: false }),
      ).rejects.toThrow('before a stage');
      expect(tx.round.update).not.toHaveBeenCalled();
    },
  );

  it.each([TournamentStatus.COMPLETED, TournamentStatus.CANCELLED])(
    'locks %s tournaments',
    async (status) => {
      const { service, round } = harness();
      round.tournament.status = status;
      await expect(
        service.updateSettings('r1', { grandFinalReset: false }),
      ).rejects.toThrow();
    },
  );

  it('rejects invalid settings and started stages', async () => {
    const { service, round } = harness();
    await expect(
      service.updateSettings('r1', { grandFinalReset: 'false' }),
    ).rejects.toThrow();
    round.status = RoundStatus.ONGOING;
    await expect(
      service.updateSettings('r1', { grandFinalReset: false }),
    ).rejects.toThrow();
  });
});
