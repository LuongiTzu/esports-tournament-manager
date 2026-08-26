import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TournamentCommandService } from '../src/tournaments/tournament-command.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('GF-2 Tournament team-size contract (database E2E)', () => {
  let prisma: PrismaService;
  let tournaments: TournamentCommandService;
  let organizerId: string;
  const tournamentIds: string[] = [];
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    tournaments = moduleRef.get(TournamentCommandService);
    const organizer = await prisma.user.create({
      data: {
        email: `gf2-organizer-${stamp}@example.test`,
        passwordHash: 'not-used-by-this-test',
        displayName: 'GF-2 Organizer',
      },
    });
    organizerId = organizer.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.tournament.deleteMany({
      where: { id: { in: tournamentIds } },
    });
    if (organizerId) {
      await prisma.user.delete({ where: { id: organizerId } });
    }
    await prisma.$disconnect();
  });

  it('persists FC Online PRESET 1 and Custom 5/7 snapshots', async () => {
    const [fcOnline, custom] = await Promise.all([
      prisma.game.findUniqueOrThrow({ where: { code: 'FC_ONLINE' } }),
      prisma.game.findUniqueOrThrow({ where: { code: 'CUSTOM' } }),
    ]);

    const fcTournament = await tournaments.create(organizerId, {
      name: `GF-2 FC ${stamp}`,
      gameId: fcOnline.id,
      teamSize: 1,
    });
    const customTournament = await tournaments.create(organizerId, {
      name: `GF-2 Custom ${stamp}`,
      gameId: custom.id,
      customGameName: 'Chess',
      teamSize: 5,
      maxTeamSize: 7,
    });
    tournamentIds.push(fcTournament!.id, customTournament!.id);

    const persisted = await prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      orderBy: { name: 'asc' },
      select: {
        gameId: true,
        customGameName: true,
        minTeamSize: true,
        maxTeamSize: true,
      },
    });

    expect(persisted).toEqual(
      expect.arrayContaining([
        {
          gameId: fcOnline.id,
          customGameName: null,
          minTeamSize: 1,
          maxTeamSize: 1,
        },
        {
          gameId: custom.id,
          customGameName: 'Chess',
          minTeamSize: 5,
          maxTeamSize: 7,
        },
      ]),
    );
  });
});
