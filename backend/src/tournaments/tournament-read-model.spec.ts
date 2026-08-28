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

describe('TournamentQueryService favorite read models', () => {
  const baseTournament = {
    id: 'tournament-1',
    slug: 'arena-cup',
    organizerId: 'organizer-1',
    visibility: Visibility.PUBLIC,
    moderationStatus: ModerationStatus.ACTIVE,
    customGameName: null,
    game: customGame,
    rounds: [],
    teams: [],
    organizer: {},
  };

  it.each([
    ['anonymous', undefined, [], false],
    ['favoriting viewer', 'user-a', [{ userId: 'user-a' }], true],
    ['other viewer', 'user-b', [], false],
  ] as const)(
    'keeps list and detail favorite state aligned for %s',
    async (_label, userId, viewerFavorites, expected) => {
      const listRow = {
        ...baseTournament,
        favorites: viewerFavorites,
        _count: { teams: 0, favorites: 1 },
      };
      const detailRow = {
        ...listRow,
        _count: { teams: 0, comments: 0, favorites: 1 },
      };
      const prisma = {
        tournament: {
          findMany: jest.fn().mockResolvedValue([listRow]),
          count: jest.fn().mockResolvedValue(1),
          findUnique: jest.fn().mockResolvedValue(detailRow),
        },
      } as unknown as PrismaService;
      const service = queryService(prisma);

      const list = await service.findAllPublic({}, userId);
      const detail = await service.findBySlug('arena-cup', userId);

      expect(list.data[0]).toEqual(
        expect.objectContaining({ favoriteCount: 1, isFavorited: expected }),
      );
      expect(detail).toEqual(
        expect.objectContaining({ favoriteCount: 1, isFavorited: expected }),
      );
      expect(list.data[0]).not.toHaveProperty('favorites');
      expect(detail).not.toHaveProperty('favorites');
    },
  );

  it('returns only visible current-user favorites in saved order', async () => {
    const favoriteRows = [
      {
        createdAt: new Date('2026-08-28T02:00:00Z'),
        tournamentId: 'public',
        tournament: {
          ...baseTournament,
          id: 'public',
          favorites: [{ userId: 'user-a' }],
          _count: { teams: 2, favorites: 4 },
          teams: [],
        },
      },
      {
        createdAt: new Date('2026-08-28T01:00:00Z'),
        tournamentId: 'private',
        tournament: {
          ...baseTournament,
          id: 'private',
          visibility: Visibility.PRIVATE,
          favorites: [{ userId: 'user-a' }],
          _count: { teams: 0, favorites: 1 },
          teams: [],
        },
      },
    ];
    const findMany = jest.fn().mockResolvedValue(favoriteRows);
    const prisma = {
      tournamentFavorite: { findMany },
    } as unknown as PrismaService;

    await expect(
      queryService(prisma).findFavoriteTournaments('user-a', 'SIGNED_UP_USER'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'public',
        favoriteCount: 4,
        isFavorited: true,
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-a' },
        orderBy: [{ createdAt: 'desc' }, { tournamentId: 'asc' }],
      }),
    );
  });
});
