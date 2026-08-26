/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import {
  GameGenre,
  GamePositionMode,
  TeamSizeMode,
  TournamentMode,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentCommandService } from './tournament-command.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { TournamentLifecyclePolicy } from './domain/tournament-lifecycle.policy';

interface TestGame {
  id: string;
  code: string;
  name: string;
  iconUrl: null;
  genre: GameGenre;
  positions: string[];
  positionMode: GamePositionMode;
  teamSizeMode: TeamSizeMode;
  defaultTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
  allowedTeamSizes: number[];
  minSelectableTeamSize: number | null;
  maxSelectableTeamSize: number | null;
}

const baseGame: TestGame = {
  id: 'fixed-game',
  code: 'LEAGUE_OF_LEGENDS',
  name: 'League of Legends',
  iconUrl: null,
  genre: GameGenre.MOBA,
  positions: ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'],
  positionMode: GamePositionMode.FIXED,
  teamSizeMode: TeamSizeMode.FIXED,
  defaultTeamSize: 5,
  minTeamSize: 5,
  maxTeamSize: 7,
  allowedTeamSizes: [],
  minSelectableTeamSize: null,
  maxSelectableTeamSize: null,
};

const presetGame: TestGame = {
  ...baseGame,
  id: 'fc-online',
  code: 'FC_ONLINE',
  name: 'FC Online',
  genre: GameGenre.SPORTS,
  positions: [],
  positionMode: GamePositionMode.NONE,
  teamSizeMode: TeamSizeMode.PRESET,
  defaultTeamSize: 3,
  minTeamSize: 1,
  maxTeamSize: 4,
  allowedTeamSizes: [1, 3],
};

const customGame: TestGame = {
  ...baseGame,
  id: 'custom-game',
  code: 'CUSTOM',
  name: 'Custom Game',
  genre: GameGenre.OTHER,
  positions: [],
  positionMode: GamePositionMode.NONE,
  teamSizeMode: TeamSizeMode.FLEXIBLE,
  defaultTeamSize: 1,
  minTeamSize: 1,
  maxTeamSize: 30,
  allowedTeamSizes: [],
  minSelectableTeamSize: 1,
  maxSelectableTeamSize: 20,
};

function contentFilter() {
  return {
    validate: jest.fn((value: string) => value.trim()),
  } as unknown as ContentFilterService;
}

function command(prisma: PrismaService, filter = contentFilter()) {
  return new TournamentCommandService(
    prisma,
    new RoundSettingsService(),
    filter,
    new TournamentLifecyclePolicy(),
  );
}

function createHarness(game: TestGame = baseGame) {
  const create = jest.fn().mockResolvedValue({ id: 'tournament-1' });
  const tx = {
    tournament: {
      create,
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve({
          id: 'tournament-1',
          customGameName: createdData(create).customGameName ?? null,
          game,
          rounds: [],
        }),
      ),
    },
  };
  const prisma = {
    game: { findFirst: jest.fn().mockResolvedValue(game) },
    tournament: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const filter = contentFilter();
  return { service: command(prisma, filter), create, filter, prisma };
}

function createdData(create: jest.Mock): Record<string, unknown> {
  return create.mock.calls[0][0].data as Record<string, unknown>;
}

function currentTournament(game: TestGame = baseGame, overrides = {}) {
  return {
    id: 'tournament-1',
    gameId: game.id,
    customGameName: game.code === 'CUSTOM' ? 'Chess' : null,
    minTeamSize: game.defaultTeamSize,
    maxTeamSize:
      game.teamSizeMode === TeamSizeMode.FIXED
        ? game.maxTeamSize
        : game.defaultTeamSize,
    mode: TournamentMode.ONLINE,
    location: null,
    minAge: null,
    maxAge: null,
    registrationStartDate: null,
    registrationDeadline: null,
    startDate: null,
    endDate: null,
    game,
    ...overrides,
  };
}

function updateHarness(
  current = currentTournament(),
  newGame: TestGame = presetGame,
) {
  const update = jest.fn().mockImplementation(({ data }) =>
    Promise.resolve({
      ...current,
      ...data,
      game: data.gameId ? newGame : current.game,
      rounds: [],
    }),
  );
  const prisma = {
    tournament: {
      findUnique: jest.fn().mockResolvedValue(current),
      update,
    },
    game: { findFirst: jest.fn().mockResolvedValue(newGame) },
  } as unknown as PrismaService;
  const filter = contentFilter();
  return { service: command(prisma, filter), update, filter };
}

function updatedData(update: jest.Mock): Record<string, unknown> {
  return update.mock.calls[0][0].data as Record<string, unknown>;
}

describe('TournamentCommandService GF-2 create contract', () => {
  it('preserves FIXED defaults and ignores a fake client minTeamSize', async () => {
    const { service, create } = createHarness();
    await service.create('organizer-1', {
      name: 'Fixed Cup',
      gameId: baseGame.id,
      minTeamSize: 2,
    } as unknown as CreateTournamentDto);

    expect(createdData(create)).toMatchObject({
      minTeamSize: 5,
      maxTeamSize: 7,
    });
  });

  it('rejects a different requested size for a FIXED game', async () => {
    const { service, create } = createHarness();
    await expect(
      service.create('organizer-1', {
        name: 'Fixed Cup',
        gameId: baseGame.id,
        teamSize: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, undefined, 3, 3],
    [1, undefined, 1, 1],
    [3, 4, 3, 4],
  ])(
    'creates PRESET snapshot team=%s max=%s as %i/%i',
    async (teamSize, maxTeamSize, expectedMin, expectedMax) => {
      const { service, create } = createHarness(presetGame);
      await service.create('organizer-1', {
        name: 'FC Cup',
        gameId: presetGame.id,
        teamSize,
        maxTeamSize,
      });
      expect(createdData(create)).toMatchObject({
        minTeamSize: expectedMin,
        maxTeamSize: expectedMax,
      });
    },
  );

  it('rejects a size outside PRESET metadata', async () => {
    const { service } = createHarness(presetGame);
    await expect(
      service.create('organizer-1', {
        name: 'FC Cup',
        gameId: presetGame.id,
        teamSize: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['  Chess  ', 1, undefined, 'Chess', 1, 1],
    ['Naruto Storm 4', 5, 7, 'Naruto Storm 4', 5, 7],
  ])(
    'creates CUSTOM %s snapshot',
    async (
      name,
      teamSize,
      maxTeamSize,
      storedName,
      expectedMin,
      expectedMax,
    ) => {
      const { service, create } = createHarness(customGame);
      const result = await service.create('organizer-1', {
        name: 'Custom Cup',
        gameId: customGame.id,
        customGameName: name,
        teamSize,
        maxTeamSize,
      });
      expect(createdData(create)).toMatchObject({
        customGameName: storedName,
        minTeamSize: expectedMin,
        maxTeamSize: expectedMax,
      });
      expect(result).toEqual(
        expect.objectContaining({ displayGameName: storedName }),
      );
    },
  );

  it.each([
    [{ teamSize: 1 }, 'missing name'],
    [{ customGameName: '   ', teamSize: 1 }, 'whitespace name'],
    [{ customGameName: 'Chess', teamSize: 21 }, 'size above range'],
    [
      { customGameName: 'Chess', teamSize: 20, maxTeamSize: 31 },
      'max above cap',
    ],
  ])('rejects invalid CUSTOM create: %s', async (fields, _label) => {
    const { service } = createHarness(customGame);
    await expect(
      service.create('organizer-1', {
        name: 'Custom Cup',
        gameId: customGame.id,
        ...fields,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects customGameName for a non-CUSTOM game', async () => {
    const { service } = createHarness();
    await expect(
      service.create('organizer-1', {
        name: 'Fixed Cup',
        gameId: baseGame.id,
        customGameName: 'Dormant Name',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes Custom name through the existing content filter', async () => {
    const { service, filter } = createHarness(customGame);
    await service.create('organizer-1', {
      name: 'Custom Cup',
      gameId: customGame.id,
      customGameName: 'Chess',
    });
    expect(filter.validate).toHaveBeenCalledWith('Chess');
  });
});

describe('TournamentCommandService GF-2 update contract', () => {
  it.each([
    [1, 1, 1],
    [undefined, 3, 3],
  ])(
    'resolves FIXED to PRESET team=%s as %i/%i',
    async (teamSize, expectedMin, expectedMax) => {
      const { service, update } = updateHarness();
      await service.update('tournament-1', {
        gameId: presetGame.id,
        teamSize,
      });
      expect(updatedData(update)).toMatchObject({
        gameId: presetGame.id,
        minTeamSize: expectedMin,
        maxTeamSize: expectedMax,
      });
    },
  );

  it('switches FIXED to CUSTOM with name and selected size', async () => {
    const { service, update } = updateHarness(currentTournament(), customGame);
    await service.update('tournament-1', {
      gameId: customGame.id,
      customGameName: '  Chess  ',
      teamSize: 1,
    });
    expect(updatedData(update)).toMatchObject({
      gameId: customGame.id,
      customGameName: 'Chess',
      minTeamSize: 1,
      maxTeamSize: 1,
    });
  });

  it('rejects switching to CUSTOM without a name', async () => {
    const { service, update } = updateHarness(currentTournament(), customGame);
    await expect(
      service.update('tournament-1', { gameId: customGame.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('clears customGameName when switching CUSTOM to a normal game', async () => {
    const { service, update } = updateHarness(
      currentTournament(customGame, { minTeamSize: 5, maxTeamSize: 7 }),
      baseGame,
    );
    await service.update('tournament-1', { gameId: baseGame.id });
    expect(updatedData(update)).toMatchObject({
      gameId: baseGame.id,
      customGameName: null,
      minTeamSize: 5,
      maxTeamSize: 7,
    });
  });

  it('rejects increasing PRESET teamSize when preserved max is too small', async () => {
    const current = currentTournament(presetGame, {
      minTeamSize: 1,
      maxTeamSize: 1,
    });
    const { service, update } = updateHarness(current, presetGame);
    await expect(
      service.update('tournament-1', { teamSize: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates PRESET teamSize when an adequate max is supplied', async () => {
    const current = currentTournament(presetGame, {
      minTeamSize: 1,
      maxTeamSize: 1,
    });
    const { service, update } = updateHarness(current, presetGame);
    await service.update('tournament-1', { teamSize: 3, maxTeamSize: 3 });
    expect(updatedData(update)).toMatchObject({
      minTeamSize: 3,
      maxTeamSize: 3,
    });
  });

  it('renames CUSTOM while preserving its roster snapshots', async () => {
    const current = currentTournament(customGame, {
      customGameName: 'Chess',
      minTeamSize: 5,
      maxTeamSize: 7,
    });
    const { service, update, filter } = updateHarness(current, customGame);
    await service.update('tournament-1', {
      customGameName: '  New Name  ',
    });
    expect(updatedData(update)).toMatchObject({ customGameName: 'New Name' });
    expect(updatedData(update).minTeamSize).toBeUndefined();
    expect(updatedData(update).maxTeamSize).toBeUndefined();
    expect(filter.validate).toHaveBeenCalledWith('  New Name  ');
  });

  it('validates max-only CUSTOM update against the current snapshot', async () => {
    const current = currentTournament(customGame, {
      minTeamSize: 5,
      maxTeamSize: 7,
    });
    const { service, update } = updateHarness(current, customGame);
    await service.update('tournament-1', { maxTeamSize: 6 });
    expect(updatedData(update)).toMatchObject({ maxTeamSize: 6 });
    expect(updatedData(update).minTeamSize).toBeUndefined();
  });

  it('rejects customGameName on a normal existing tournament', async () => {
    const { service } = updateHarness();
    await expect(
      service.update('tournament-1', { customGameName: 'Dormant' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
