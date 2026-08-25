import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TeamsService } from '../src/teams/teams.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('team registration concurrency (database E2E)', () => {
  let prisma: PrismaService;
  let teams: TeamsService;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  let gameId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    teams = moduleRef.get(TeamsService);

    const game = await prisma.game.create({
      data: {
        code: `BE5_TEST_${stamp}`,
        name: `BE5 Test Game ${stamp}`,
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    gameId = game.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({
        where: { tournamentId: { in: tournamentIds } },
      });
      await prisma.tournament.deleteMany({
        where: { id: { in: tournamentIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (gameId) await prisma.game.deleteMany({ where: { id: gameId } });
      await prisma.$disconnect();
    }
  });

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `be5-${label}-${stamp}@example.test`,
        passwordHash: 'not-used-by-this-test',
        displayName: `BE5 ${label}`,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createTournament(
    organizerId: string,
    label: string,
    maxTeams: number,
  ) {
    const tournament = await prisma.tournament.create({
      data: {
        name: `BE5 ${label} ${stamp}`,
        slug: `be5-${label.toLowerCase()}-${stamp}`,
        gameId,
        organizerId,
        minTeamSize: 1,
        maxTeamSize: 1,
        maxTeams,
        requireMemberFullInfo: false,
      },
    });
    tournamentIds.push(tournament.id);
    return tournament;
  }

  function registration(name: string, ign: string) {
    return {
      name,
      contactName: name,
      contactEmail: `${name.replaceAll(' ', '-').toLowerCase()}@example.test`,
      contactPhone: '0900000000',
      members: [{ realName: name, ign }],
    };
  }

  it('never exceeds capacity under concurrent registration', async () => {
    const organizer = await createUser('capacity-organizer');
    const first = await createUser('capacity-first');
    const second = await createUser('capacity-second');
    const tournament = await createTournament(organizer.id, 'Capacity', 1);

    const results = await Promise.allSettled([
      teams.register(
        first.id,
        tournament.slug,
        registration(`Capacity A ${stamp}`, `capacity-a-${stamp}`),
      ),
      teams.register(
        second.id,
        tournament.slug,
        registration(`Capacity B ${stamp}`, `capacity-b-${stamp}`),
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await prisma.team.count({ where: { tournamentId: tournament.id } }),
    ).toBe(1);
  });

  it('prevents concurrent cross-team duplicate participant identities', async () => {
    const organizer = await createUser('duplicate-organizer');
    const first = await createUser('duplicate-first');
    const second = await createUser('duplicate-second');
    const tournament = await createTournament(organizer.id, 'Duplicate', 4);
    const sharedIgn = `same-ign-${stamp}`;

    const results = await Promise.allSettled([
      teams.register(
        first.id,
        tournament.slug,
        registration(`Duplicate A ${stamp}`, sharedIgn),
      ),
      teams.register(
        second.id,
        tournament.slug,
        registration(`Duplicate B ${stamp}`, sharedIgn),
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await prisma.teamMember.count({
        where: { team: { tournamentId: tournament.id }, ign: sharedIgn },
      }),
    ).toBe(1);
  });

  it('keeps an invalid persisted roster pending when approval fails', async () => {
    const organizer = await createUser('approval-organizer');
    const captain = await createUser('approval-captain');
    const tournament = await createTournament(organizer.id, 'Approval', 2);
    const pending = await prisma.team.create({
      data: {
        name: `Invalid Pending ${stamp}`,
        contactName: captain.displayName,
        contactEmail: captain.email,
        captainId: captain.id,
        tournamentId: tournament.id,
      },
    });

    await expect(
      teams.updateStatus(pending.id, { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      prisma.team.findUniqueOrThrow({ where: { id: pending.id } }),
    ).resolves.toMatchObject({ status: 'PENDING', reviewedAt: null });
    expect(
      await prisma.notification.count({
        where: { tournamentId: tournament.id, userId: captain.id },
      }),
    ).toBe(0);
  });

  it('allows a captain to register after a rejected historical record', async () => {
    const organizer = await createUser('history-organizer');
    const captain = await createUser('history-captain');
    const tournament = await createTournament(organizer.id, 'History', 2);
    await prisma.team.create({
      data: {
        name: `Rejected History ${stamp}`,
        contactName: captain.displayName,
        contactEmail: captain.email,
        captainId: captain.id,
        tournamentId: tournament.id,
        status: 'REJECTED',
      },
    });

    await expect(
      teams.register(
        captain.id,
        tournament.slug,
        registration(`New Registration ${stamp}`, `history-${stamp}`),
      ),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });
});
