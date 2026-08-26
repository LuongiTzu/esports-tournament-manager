import { Test } from '@nestjs/testing';
import { MemberRole, RegistrationStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TeamsService } from '../src/teams/teams.service';
import { RegistrationMemberInput } from '../src/teams/types/registration-member-input';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('team registration concurrency (database E2E)', () => {
  let prisma: PrismaService;
  let teams: TeamsService;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  let gameId: string;
  let fcOnlineGameId: string;
  let customGameId: string;
  let crossFireGameId: string;

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

    const canonicalGames = await prisma.game.findMany({
      where: {
        code: { in: ['FC_ONLINE', 'CUSTOM', 'CROSSFIRE_PC'] },
      },
      select: { id: true, code: true },
    });
    const idsByCode = new Map(
      canonicalGames.map((catalogGame) => [catalogGame.code, catalogGame.id]),
    );
    fcOnlineGameId = requireGameId(idsByCode, 'FC_ONLINE');
    customGameId = requireGameId(idsByCode, 'CUSTOM');
    crossFireGameId = requireGameId(idsByCode, 'CROSSFIRE_PC');
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
    options: {
      gameId?: string;
      minTeamSize?: number;
      maxTeamSize?: number;
      customGameName?: string;
    } = {},
  ) {
    const tournament = await prisma.tournament.create({
      data: {
        name: `BE5 ${label} ${stamp}`,
        slug: `be5-${label.toLowerCase()}-${stamp}`,
        gameId: options.gameId ?? gameId,
        organizerId,
        minTeamSize: options.minTeamSize ?? 1,
        maxTeamSize: options.maxTeamSize ?? 1,
        customGameName: options.customGameName,
        maxTeams,
        requireMemberFullInfo: false,
      },
    });
    tournamentIds.push(tournament.id);
    return tournament;
  }

  function registration(
    name: string,
    ign: string,
    members: RegistrationMemberInput[] = [
      {
        realName: name,
        ign,
        memberRole: MemberRole.CAPTAIN,
      },
    ],
  ) {
    return {
      name,
      contactName: name,
      contactEmail: `${name.replaceAll(' ', '-').toLowerCase()}@example.test`,
      contactPhone: '0900000000',
      members,
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

  it('persists an FC Online individual roster with one active captain', async () => {
    const organizer = await createUser('fc-individual-organizer');
    const captain = await createUser('fc-individual-captain');
    const tournament = await createTournament(
      organizer.id,
      'FC Individual',
      8,
      { gameId: fcOnlineGameId, minTeamSize: 1, maxTeamSize: 1 },
    );

    const created = await teams.register(
      captain.id,
      tournament.slug,
      registration(`FC Individual ${stamp}`, `fc-individual-${stamp}`),
    );
    if (!created) throw new Error('FC Online registration was not persisted');
    const persisted = await prisma.teamMember.findMany({
      where: { teamId: created.id },
      select: { memberRole: true },
    });

    expect(persisted).toEqual([{ memberRole: MemberRole.CAPTAIN }]);
  });

  it('persists a Custom 5v5 roster with two substitutes', async () => {
    const organizer = await createUser('custom-organizer');
    const captain = await createUser('custom-captain');
    const tournament = await createTournament(organizer.id, 'Custom 5v5', 8, {
      gameId: customGameId,
      minTeamSize: 5,
      maxTeamSize: 7,
      customGameName: 'GF-3 Custom Fixture',
    });
    const members = Array.from({ length: 7 }, (_, index) => ({
      realName: `Custom Member ${index}`,
      ign: `custom-member-${index}-${stamp}`,
      memberRole:
        index === 0
          ? MemberRole.CAPTAIN
          : index < 5
            ? MemberRole.PLAYER
            : MemberRole.SUBSTITUTE,
    }));

    const created = await teams.register(
      captain.id,
      tournament.slug,
      registration(`Custom Team ${stamp}`, members[0].ign, members),
    );
    if (!created) throw new Error('Custom registration was not persisted');
    const persisted = await prisma.teamMember.groupBy({
      by: ['memberRole'],
      where: { teamId: created.id },
      _count: true,
    });

    expect(persisted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ memberRole: MemberRole.CAPTAIN, _count: 1 }),
        expect.objectContaining({ memberRole: MemberRole.PLAYER, _count: 4 }),
        expect.objectContaining({
          memberRole: MemberRole.SUBSTITUTE,
          _count: 2,
        }),
      ]),
    );
  });

  it('keeps an invalid Custom roster pending without approval notification', async () => {
    const organizer = await createUser('custom-review-organizer');
    const captain = await createUser('custom-review-captain');
    const tournament = await createTournament(
      organizer.id,
      'Custom Review',
      8,
      {
        gameId: customGameId,
        minTeamSize: 5,
        maxTeamSize: 7,
        customGameName: 'GF-3 Review Fixture',
      },
    );
    const pending = await prisma.team.create({
      data: {
        name: `Invalid Custom Pending ${stamp}`,
        contactName: captain.displayName,
        contactEmail: captain.email,
        captainId: captain.id,
        tournamentId: tournament.id,
        members: {
          create: [
            {
              realName: 'Only Captain',
              ign: `invalid-custom-${stamp}`,
              memberRole: MemberRole.CAPTAIN,
            },
          ],
        },
      },
    });

    await expect(
      teams.updateStatus(pending.id, { status: RegistrationStatus.APPROVED }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      prisma.team.findUniqueOrThrow({ where: { id: pending.id } }),
    ).resolves.toMatchObject({
      status: RegistrationStatus.PENDING,
      reviewedAt: null,
    });
    expect(
      await prisma.notification.count({
        where: { tournamentId: tournament.id, userId: captain.id },
      }),
    ).toBe(0);
  });

  it('approves CrossFire duplicate tactical positions', async () => {
    const organizer = await createUser('crossfire-organizer');
    const captain = await createUser('crossfire-captain');
    const tournament = await createTournament(organizer.id, 'CrossFire', 8, {
      gameId: crossFireGameId,
      minTeamSize: 5,
      maxTeamSize: 6,
    });
    const positions = ['ATTACKER', 'ATTACKER', 'SNIPER', 'ORDER', undefined];
    const members = positions.map((position, index) => ({
      realName: `CrossFire Member ${index}`,
      ign: `crossfire-member-${index}-${stamp}`,
      memberRole: index === 0 ? MemberRole.CAPTAIN : MemberRole.PLAYER,
      position,
    }));
    const created = await teams.register(
      captain.id,
      tournament.slug,
      registration(`CrossFire Team ${stamp}`, members[0].ign, members),
    );
    if (!created) throw new Error('CrossFire registration was not persisted');

    await expect(
      teams.updateStatus(created.id, { status: RegistrationStatus.APPROVED }),
    ).resolves.toMatchObject({ status: RegistrationStatus.APPROVED });
  });
});

function requireGameId(idsByCode: Map<string, string>, code: string): string {
  const id = idsByCode.get(code);
  if (!id) {
    throw new Error(
      `Missing canonical game ${code}; run the safe catalog synchronization first`,
    );
  }
  return id;
}
