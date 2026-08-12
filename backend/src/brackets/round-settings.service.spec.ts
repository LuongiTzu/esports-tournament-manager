import { BadRequestException } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import { RoundSettingsService } from './round-settings.service';
import { DEFAULT_ROUND_SETTINGS } from './types/round-settings';
import type { SwissSettings } from './types/round-settings';

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
      { doubleRound: true, pointsWin: 5, pointsDraw: 2, pointsLoss: 1 },
    ],
    [
      RoundFormat.GROUP_STAGE,
      { numGroups: 8, teamsPerGroup: 3, advanceCount: 1, doubleRound: true },
    ],
    [
      RoundFormat.SWISS,
      {
        numRounds: 7,
        pointsWin: 2,
        pointsDraw: 1,
        pointsLoss: 0,
        tiebreakers: ['SCORE_DIFF', 'BUCHHOLZ'],
        advanceCount: 16,
      },
    ],
    [RoundFormat.PLAYOFF, { seeding: 'STANDARD', thirdPlaceMatch: false }],
    [RoundFormat.DOUBLE_ELIM, { seeding: 'STANDARD', grandFinalReset: false }],
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
        numGroups: 2,
      }),
    ).resolves.toEqual({
      numGroups: 2,
      teamsPerGroup: 4,
      advanceCount: 2,
      doubleRound: false,
    });
  });

  it('does not let undefined values erase defaults', async () => {
    await expect(
      service.normalizeForFormat(RoundFormat.PLAYOFF, {
        thirdPlaceMatch: undefined,
      }),
    ).resolves.toEqual(DEFAULT_ROUND_SETTINGS[RoundFormat.PLAYOFF]);
  });

  it('does not expose mutable nested default values', async () => {
    const result = (await service.normalizeForFormat(
      RoundFormat.SWISS,
    )) as SwissSettings;

    expect(result.tiebreakers).not.toBe(
      DEFAULT_ROUND_SETTINGS[RoundFormat.SWISS].tiebreakers,
    );
  });

  it.each([
    [RoundFormat.ROUND_ROBIN, { pointsLoss: -1 }],
    [RoundFormat.ROUND_ROBIN, { pointsWin: 1, pointsDraw: 2 }],
    [RoundFormat.GROUP_STAGE, { numGroups: 0 }],
    [RoundFormat.GROUP_STAGE, { teamsPerGroup: 2, advanceCount: 3 }],
    [RoundFormat.SWISS, { numRounds: 0 }],
    [RoundFormat.SWISS, { tiebreakers: ['INVALID'] }],
    [RoundFormat.SWISS, { advanceCount: 0 }],
    [RoundFormat.PLAYOFF, { seeding: 'RANDOM' }],
    [RoundFormat.DOUBLE_ELIM, { grandFinalReset: 'yes' }],
  ])('rejects invalid settings for %s', async (format, settings) => {
    await expect(
      service.normalizeForFormat(
        format as RoundFormat,
        settings as Record<string, unknown>,
      ),
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
});
