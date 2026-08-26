import {
  GameGenre,
  GamePositionMode,
  ModerationStatus,
  TeamSizeMode,
  Visibility,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentQueryService } from './tournament-query.service';
import { TOURNAMENT_GAME_SELECT } from './tournament-prisma.select';

const customGame = {
  id: 'custom-game',
  code: 'CUSTOM',
  name: 'Custom Game',
  iconUrl: null,
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

function queryService(prisma: PrismaService) {
  return new TournamentQueryService(
    prisma,
    new RoundSettingsService(),
    {} as StandingsService,
  );
}

describe('TournamentQueryService GF-5 read models', () => {
  it('returns detail structural metadata and a derived CUSTOM display name', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'tournament-1',
      slug: 'chess-cup',
      organizerId: 'organizer-1',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
      customGameName: 'Chess',
      minTeamSize: 1,
      maxTeamSize: 1,
      game: customGame,
      rounds: [],
      teams: [],
      organizer: {},
      _count: { teams: 0, comments: 0 },
    });
    const prisma = { tournament: { findUnique } } as unknown as PrismaService;

    await expect(queryService(prisma).findBySlug('chess-cup')).resolves.toEqual(
      expect.objectContaining({
        customGameName: 'Chess',
        displayGameName: 'Chess',
        minTeamSize: 1,
        maxTeamSize: 1,
        game: expect.objectContaining({
          code: 'CUSTOM',
          teamSizeMode: TeamSizeMode.FLEXIBLE,
          minSelectableTeamSize: 1,
          maxSelectableTeamSize: 20,
        }),
      }),
    );
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          game: { select: TOURNAMENT_GAME_SELECT },
        }),
      }),
    );
  });

  it('keeps organizer lists compact while exposing code and display name', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'tournament-1',
        customGameName: 'Chess',
        game: {
          id: customGame.id,
          code: customGame.code,
          name: customGame.name,
          iconUrl: null,
        },
        _count: { teams: 2 },
      },
    ]);
    const prisma = { tournament: { findMany } } as unknown as PrismaService;

    await expect(
      queryService(prisma).findMyTournaments('organizer-1', 'organized'),
    ).resolves.toEqual([
      expect.objectContaining({
        displayGameName: 'Chess',
        game: expect.objectContaining({ code: 'CUSTOM' }),
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          game: {
            select: { id: true, code: true, name: true, iconUrl: true },
          },
        }),
      }),
    );
  });
});
