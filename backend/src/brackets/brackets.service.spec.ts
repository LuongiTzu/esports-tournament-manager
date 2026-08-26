/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { BadRequestException } from '@nestjs/common';
import { BracketType, RoundFormat } from '@prisma/client';
import { BracketsService } from './brackets.service';
import { DoubleElimGenerator } from './generators/double-elim.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { PlayoffGenerator } from './generators/playoff.generator';
import { RoundRobinGenerator } from './generators/round-robin.generator';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import { IBracketGenerator, MatchDraft } from './types/bracket-generator';
import { DEFAULT_ROUND_SETTINGS } from './types/round-settings';

const teams = [
  {
    id: 'team-1',
    name: 'Team 1',
    seed: 1,
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const draft: MatchDraft = {
  key: 'winner-1-1',
  teamA: { teamId: 'team-1' },
  teamB: {
    teamId: null,
    sourceMatchKey: 'winner-0-1',
    sourceResult: 'WINNER',
  },
  bracketRound: 1,
  bracketType: BracketType.WINNER,
  matchNumber: 1,
  isBye: false,
  bestOf: 3,
  nextMatchKey: 'winner-2-1',
  nextMatchSlot: 'A',
  loserNextMatchKey: 'loser-1-1',
  loserNextMatchSlot: 'B',
  group: { key: 'group-a', name: 'Group A', orderIndex: 1 },
};

function generator(format: RoundFormat): IBracketGenerator {
  return { format, generate: jest.fn().mockReturnValue([draft]) };
}

describe('BracketsService', () => {
  const formats = Object.values(RoundFormat);
  let settingsService: Pick<RoundSettingsService, 'normalizeForFormat'>;
  let strategies: Record<RoundFormat, IBracketGenerator>;
  let service: BracketsService;

  beforeEach(() => {
    settingsService = {
      normalizeForFormat: jest.fn(async (format) =>
        structuredClone(DEFAULT_ROUND_SETTINGS[format]),
      ),
    };
    strategies = Object.fromEntries(
      formats.map((format) => [format, generator(format)]),
    ) as Record<RoundFormat, IBracketGenerator>;
    service = new BracketsService(
      settingsService as RoundSettingsService,
      strategies[RoundFormat.ROUND_ROBIN] as RoundRobinGenerator,
      strategies[RoundFormat.GROUP_STAGE] as GroupStageGenerator,
      strategies[RoundFormat.SWISS] as SwissGenerator,
      strategies[RoundFormat.PLAYOFF] as PlayoffGenerator,
      strategies[RoundFormat.DOUBLE_ELIM] as DoubleElimGenerator,
    );
  });

  it.each(formats)('selects the %s generator', async (format) => {
    await expect(
      service.generate({ format, teams, bestOf: 3 }),
    ).resolves.toEqual([draft]);

    expect(strategies[format].generate).toHaveBeenCalledTimes(1);
    for (const otherFormat of formats.filter((value) => value !== format)) {
      expect(strategies[otherFormat].generate).not.toHaveBeenCalled();
    }
  });

  it('rejects an unsupported runtime format before normalization', async () => {
    await expect(
      service.generate({
        format: 'UNKNOWN' as RoundFormat,
        teams,
        bestOf: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(settingsService.normalizeForFormat).not.toHaveBeenCalled();
  });

  it('passes normalized settings and round bestOf to the strategy', async () => {
    await service.generate({
      format: RoundFormat.GROUP_STAGE,
      teams,
      settings: { numGroups: 2 },
      bestOf: 7,
    });

    expect(settingsService.normalizeForFormat).toHaveBeenCalledWith(
      RoundFormat.GROUP_STAGE,
      { numGroups: 2 },
    );
    expect(strategies[RoundFormat.GROUP_STAGE].generate).toHaveBeenCalledWith({
      format: RoundFormat.GROUP_STAGE,
      teams,
      settings: DEFAULT_ROUND_SETTINGS[RoundFormat.GROUP_STAGE],
      bestOf: 7,
    });
  });

  it('supports the complete persistence-neutral MatchDraft shape', () => {
    expect(draft).toEqual(
      expect.objectContaining({
        key: expect.any(String),
        teamA: expect.objectContaining({ teamId: expect.any(String) }),
        teamB: expect.objectContaining({
          teamId: null,
          sourceMatchKey: expect.any(String),
          sourceResult: 'WINNER',
        }),
        bracketRound: expect.any(Number),
        bracketType: BracketType.WINNER,
        matchNumber: expect.any(Number),
        isBye: false,
        bestOf: 3,
        nextMatchKey: expect.any(String),
        nextMatchSlot: 'A',
        loserNextMatchKey: expect.any(String),
        loserNextMatchSlot: 'B',
        group: expect.objectContaining({ key: expect.any(String) }),
      }),
    );
  });
});
