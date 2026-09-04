import { BadRequestException } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import { RoundSettingsService } from './round-settings.service';
import { DEFAULT_ROUND_SETTINGS } from './types/round-settings';

describe('RoundSettingsService', () => {
  let service: RoundSettingsService;

  beforeEach(() => {
    service = new RoundSettingsService();
  });

  describe.each(Object.values(RoundFormat))('%s', (format) => {
    it('returns a complete JSON-serializable default shape', async () => {
      const result = await service.normalizeForFormat(format);

      expect(result).toEqual(DEFAULT_ROUND_SETTINGS[format]);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(result).not.toBe(DEFAULT_ROUND_SETTINGS[format]);
    });
  });

  it.each([
    [
      RoundFormat.ROUND_ROBIN,
      {
        scoringMode: 'SERIES_SCORE',
        advancingTeamCount: 4,
        winPoints: 5,
        drawPoints: 2,
        lossPoints: 1,
        allowDraws: true,
        meetingsPerPair: 2,
      },
    ],
    [
      RoundFormat.GROUP_STAGE,
      {
        scoringMode: 'SERIES_SCORE',
        numberOfGroups: 8,
        advancingTeamsPerGroup: 1,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        allowDraws: true,
        meetingsPerPair: 2,
      },
    ],
    [
      RoundFormat.SWISS,
      {
        scoringMode: 'SERIES_SCORE',
        numberOfRounds: 7,
        advancingTeamCount: 16,
      },
    ],
    [
      RoundFormat.PLAYOFF,
      { scoringMode: 'SERIES_SCORE', thirdPlaceMatch: false },
    ],
    [
      RoundFormat.DOUBLE_ELIM,
      { scoringMode: 'SERIES_SCORE', grandFinalReset: false },
    ],
  ] as const)(
    'accepts valid custom settings for %s',
    async (format, settings) => {
      await expect(
        service.normalizeForFormat(format, { ...settings }),
      ).resolves.toEqual(settings);
    },
  );

  it('fills omitted values from the format defaults', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.GROUP_STAGE, {
        numberOfGroups: 4,
      }),
    ).resolves.toEqual({
      scoringMode: 'SERIES_SCORE',
      numberOfGroups: 4,
      advancingTeamsPerGroup: 2,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: false,
      meetingsPerPair: 1,
    });
  });

  it('fills omitted Round Robin values without overwriting defaults', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.ROUND_ROBIN, {
        allowDraws: true,
        meetingsPerPair: 2,
      }),
    ).resolves.toEqual({
      scoringMode: 'SERIES_SCORE',
      advancingTeamCount: 2,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 2,
    });
  });

  it('does not let undefined values erase defaults', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.PLAYOFF, {
        thirdPlaceMatch: undefined,
      }),
    ).resolves.toEqual(DEFAULT_ROUND_SETTINGS[RoundFormat.PLAYOFF]);
  });

  it('supports automatic Swiss round-count derivation through null', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.SWISS),
    ).resolves.toEqual({
      scoringMode: 'SERIES_SCORE',
      numberOfRounds: null,
      advancingTeamCount: 8,
    });
  });

  it('accepts POINT_SCORE only with BO1', async () => {
    await expect(
      service.normalizeForFormat(
        RoundFormat.PLAYOFF,
        { scoringMode: 'POINT_SCORE', thirdPlaceMatch: false },
        1,
      ),
    ).resolves.toEqual({
      scoringMode: 'POINT_SCORE',
      thirdPlaceMatch: false,
    });
    await expect(
      service.normalizeForFormat(
        RoundFormat.PLAYOFF,
        { scoringMode: 'POINT_SCORE', thirdPlaceMatch: false },
        3,
      ),
    ).rejects.toThrow('POINT_SCORE requires bestOf = 1');
  });

  it('rejects an unknown scoring mode', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.PLAYOFF, {
        scoringMode: 'GOALS',
        thirdPlaceMatch: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falls back safely when legacy JSON contains an unknown scoring mode', () => {
    expect(
      service.getEffectiveSettings(RoundFormat.PLAYOFF, {
        scoringMode: 'GOALS',
        thirdPlaceMatch: false,
      }),
    ).toEqual({ scoringMode: 'SERIES_SCORE', thirdPlaceMatch: false });
  });

  it.each([
    [RoundFormat.ROUND_ROBIN, { advancingTeamCount: 0 }],
    [RoundFormat.ROUND_ROBIN, { lossPoints: -1 }],
    [RoundFormat.ROUND_ROBIN, { winPoints: 0, lossPoints: 0 }],
    [RoundFormat.ROUND_ROBIN, { meetingsPerPair: 0 }],
    [RoundFormat.ROUND_ROBIN, { meetingsPerPair: 5 }],
    [RoundFormat.ROUND_ROBIN, { meetingsPerPair: 1.5 }],
    [
      RoundFormat.ROUND_ROBIN,
      { allowDraws: true, winPoints: 2, drawPoints: 2 },
    ],
    [RoundFormat.GROUP_STAGE, { numberOfGroups: 0 }],
    [RoundFormat.GROUP_STAGE, { advancingTeamsPerGroup: 0 }],
    [RoundFormat.GROUP_STAGE, { meetingsPerPair: 5 }],
    [RoundFormat.GROUP_STAGE, { winPoints: 0, lossPoints: 0 }],
    [
      RoundFormat.GROUP_STAGE,
      { allowDraws: true, winPoints: 2, drawPoints: 2 },
    ],
    [RoundFormat.SWISS, { numberOfRounds: 0 }],
    [RoundFormat.SWISS, { numberOfRounds: 21 }],
    [RoundFormat.SWISS, { advancingTeamCount: 0 }],
    [RoundFormat.PLAYOFF, { thirdPlaceMatch: 'yes' }],
    [RoundFormat.DOUBLE_ELIM, { grandFinalReset: 'yes' }],
  ])('rejects invalid settings for %s', async (format, settings) => {
    await expect(
      service.normalizeForFormat(format, settings as Record<string, unknown>),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects fields belonging to another format', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.PLAYOFF, {
        thirdPlaceMatch: true,
        doubleRound: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [RoundFormat.PLAYOFF, { seeding: 'STANDARD', thirdPlaceMatch: false }],
    [RoundFormat.DOUBLE_ELIM, { seeding: 'STANDARD', grandFinalReset: false }],
  ] as const)(
    'removes legacy fixed seeding from %s responses',
    (format, stored) => {
      expect(service.getEffectiveSettings(format, stored)).toEqual(
        format === RoundFormat.PLAYOFF
          ? { scoringMode: 'SERIES_SCORE', thirdPlaceMatch: false }
          : { scoringMode: 'SERIES_SCORE', grandFinalReset: false },
      );
    },
  );

  it('normalizes legacy Round Robin keys when reading stored settings', () => {
    expect(
      service.getEffectiveSettings(RoundFormat.ROUND_ROBIN, {
        doubleRound: true,
        pointsWin: 2,
        pointsDraw: 1,
        pointsLoss: 0,
      }),
    ).toEqual({
      scoringMode: 'SERIES_SCORE',
      advancingTeamCount: 2,
      winPoints: 2,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: false,
      meetingsPerPair: 2,
    });
  });

  it('normalizes legacy Round Robin advanceCount', () => {
    expect(
      service.getEffectiveSettings(RoundFormat.ROUND_ROBIN, {
        advanceCount: 4,
      }),
    ).toEqual({
      scoringMode: 'SERIES_SCORE',
      advancingTeamCount: 4,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: false,
      meetingsPerPair: 1,
    });
  });

  it('normalizes legacy Group Stage keys and preserves historical draw behavior', () => {
    expect(
      service.getEffectiveSettings(RoundFormat.GROUP_STAGE, {
        numGroups: 4,
        teamsPerGroup: 4,
        advanceCount: 2,
        doubleRound: true,
        pointsWin: 2,
        pointsDraw: 0,
        pointsLoss: 0,
      }),
    ).toEqual({
      scoringMode: 'SERIES_SCORE',
      numberOfGroups: 4,
      advancingTeamsPerGroup: 2,
      winPoints: 2,
      drawPoints: 0,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 2,
    });
  });

  it('returns the explicit no-draw default for new Group Stage settings', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.GROUP_STAGE),
    ).resolves.toEqual(
      expect.objectContaining({ allowDraws: false, meetingsPerPair: 1 }),
    );
  });

  it('normalizes legacy Swiss keys and drops unsupported legacy controls', () => {
    expect(
      service.getEffectiveSettings(RoundFormat.SWISS, {
        numRounds: 6,
        advanceCount: 4,
        pointsWin: 2,
        pointsDraw: 1,
        pointsLoss: 0,
        tiebreakers: ['SCORE_DIFF'],
      }),
    ).toEqual({
      scoringMode: 'SERIES_SCORE',
      numberOfRounds: 6,
      advancingTeamCount: 4,
    });
  });
});
