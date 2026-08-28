import { Test } from '@nestjs/testing';
import { ModerationStatus, Visibility } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TournamentsService } from '../src/tournaments/tournaments.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('Tournament Favorite database contract', () => {
  let prisma: PrismaService;
  let tournaments: TournamentsService;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  let gameId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    tournaments = moduleRef.get(TournamentsService);
    const game = await prisma.game.create({
      data: {
        code: `RF2_TEST_${stamp}`,
        name: `RF2 Test Game ${stamp}`,
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    gameId = game.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.tournament.deleteMany({
      where: { id: { in: tournamentIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (gameId) await prisma.game.deleteMany({ where: { id: gameId } });
    await prisma.$disconnect();
  });

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `rf2-${label}-${stamp}@example.test`,
        passwordHash: 'not-used-by-this-test',
        displayName: `RF2 ${label}`,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createTournament(
    organizerId: string,
    label: string,
    visibility: Visibility = Visibility.PUBLIC,
  ) {
    const tournament = await prisma.tournament.create({
      data: {
        name: `RF2 ${label} ${stamp}`,
        slug: `rf2-${label.toLowerCase()}-${stamp}`,
        organizerId,
        gameId,
        minTeamSize: 1,
        maxTeamSize: 1,
        visibility,
        moderationStatus: ModerationStatus.ACTIVE,
      },
    });
    tournamentIds.push(tournament.id);
    return tournament;
  }

  it('enforces one row under concurrent favorites and exposes viewer state', async () => {
    const organizer = await createUser('organizer');
    const viewer = await createUser('viewer');
    const tournament = await createTournament(organizer.id, 'Concurrency');

    await Promise.all(
      Array.from({ length: 8 }, () =>
        tournaments.favorite(viewer.id, tournament.slug),
      ),
    );
    expect(
      await prisma.tournamentFavorite.count({
        where: { userId: viewer.id, tournamentId: tournament.id },
      }),
    ).toBe(1);

    const anonymousList = await tournaments.findAllPublic({ search: stamp });
    const viewerList = await tournaments.findAllPublic(
      { search: stamp },
      viewer.id,
    );
    const detail = await tournaments.findBySlug(
      tournament.slug,
      viewer.id,
      'SIGNED_UP_USER',
    );
    expect(anonymousList.data[0]).toEqual(
      expect.objectContaining({ favoriteCount: 1, isFavorited: false }),
    );
    expect(viewerList.data[0]).toEqual(
      expect.objectContaining({ favoriteCount: 1, isFavorited: true }),
    );
    expect(detail).toEqual(
      expect.objectContaining({ favoriteCount: 1, isFavorited: true }),
    );

    await expect(
      tournaments.unfavorite(viewer.id, tournament.slug),
    ).resolves.toEqual({ isFavorited: false, favoriteCount: 0 });
    await expect(
      tournaments.unfavorite(viewer.id, tournament.slug),
    ).resolves.toEqual({ isFavorited: false, favoriteCount: 0 });
  });

  it('does not leak a saved Tournament after the viewer loses access', async () => {
    const organizer = await createUser('private-organizer');
    const viewer = await createUser('former-viewer');
    const tournament = await createTournament(
      organizer.id,
      'Private',
      Visibility.PRIVATE,
    );
    await prisma.tournamentFavorite.create({
      data: { userId: viewer.id, tournamentId: tournament.id },
    });

    await expect(
      tournaments.findFavoriteTournaments(viewer.id, 'SIGNED_UP_USER'),
    ).resolves.toEqual([]);
    expect(
      await prisma.tournamentFavorite.count({
        where: { userId: viewer.id, tournamentId: tournament.id },
      }),
    ).toBe(1);
  });
});
