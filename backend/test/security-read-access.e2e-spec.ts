import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { RegistrationStatus, Role, TournamentStaffRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

const actorRoles = {
  organizer: Role.SIGNED_UP_USER,
  captain: Role.SIGNED_UP_USER,
  member: Role.SIGNED_UP_USER,
  outsider: Role.SIGNED_UP_USER,
  coOrganizer: Role.SIGNED_UP_USER,
  referee: Role.SIGNED_UP_USER,
  admin: Role.ADMIN,
  overrideAdmin: Role.ADMIN,
} as const;
type Actor = keyof typeof actorRoles;

describeDatabase('public read privacy (database E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tournamentId: string;
  const slug = `security-${randomUUID()}`;
  const userIds = new Map<Actor, string>();
  const tokens = new Map<Actor, string>();
  const teamIds = new Map<RegistrationStatus, string>();

  function userId(actor: Actor) {
    const value = userIds.get(actor);
    if (!value) throw new Error(`Missing test actor ${actor}`);
    return value;
  }

  function teamId(status: RegistrationStatus) {
    const value = teamIds.get(status);
    if (!value) throw new Error(`Missing test team ${status}`);
    return value;
  }

  function get(path: string, actor?: Actor) {
    const req = request(app.getHttpServer() as Server).get(path);
    if (actor) {
      const token = tokens.get(actor);
      if (!token) throw new Error(`Missing test token ${actor}`);
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    configureApp(app);
    await app.init();
    const jwt = moduleRef.get(JwtService);

    for (const actor of Object.keys(actorRoles) as Actor[]) {
      const user = await prisma.user.create({
        data: {
          email: `${actor}-${slug}@example.com`,
          displayName: `Security test ${actor}`,
          role: actorRoles[actor],
          emailVerifiedAt: new Date(),
        },
      });
      userIds.set(actor, user.id);
      tokens.set(
        actor,
        jwt.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
          tokenVersion: user.tokenVersion,
        }),
      );
    }

    const game = await prisma.game.findFirstOrThrow({
      where: { defaultTeamSize: 1 },
    });
    const tournament = await prisma.tournament.create({
      data: {
        name: 'Public security test cup',
        slug,
        organizerId: userId('organizer'),
        gameId: game.id,
        visibility: 'PUBLIC',
        minTeamSize: 1,
        maxTeamSize: 2,
        staff: {
          create: [
            {
              userId: userId('coOrganizer'),
              role: TournamentStaffRole.CO_ORGANIZER,
            },
            { userId: userId('referee'), role: TournamentStaffRole.REFEREE },
          ],
        },
        adminOverrides: {
          create: {
            adminId: userId('overrideAdmin'),
            reason: 'Security test authorized review',
            expiresAt: new Date(Date.now() + 60 * 60_000),
          },
        },
      },
    });
    tournamentId = tournament.id;

    for (const status of Object.values(RegistrationStatus)) {
      const team = await prisma.team.create({
        data: {
          name: `Security team ${status}`,
          status,
          tournamentId,
          captainId: userId('captain'),
          contactName: 'Private representative',
          contactEmail: 'private-representative@example.com',
          contactPhone: '0900000000',
          rejectReason: status === 'REJECTED' ? 'Private review note' : null,
          members: {
            create: {
              userId: userId('member'),
              realName: 'Private applicant',
              ign: `player-${status}`,
              email: 'private-member@example.com',
              phoneNumber: '0900000001',
            },
          },
        },
      });
      teamIds.set(status, team.id);
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (tournamentId) {
        await prisma.tournament.deleteMany({ where: { id: tournamentId } });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [...userIds.values()] } },
      });
    }
    if (app) await app.close();
  });

  it.each([undefined, 'outsider', 'organizer'] as const)(
    'omits team contact data from both tournament detail routes for %p',
    async (actor) => {
      for (const path of [
        `/api/tournaments/${slug}`,
        `/api/tournaments/slug/${slug}`,
      ]) {
        const response = await get(path, actor).expect(200);
        const body = response.body as {
          data: { teams: Record<string, unknown>[] };
        };
        expect(body.data.teams).toHaveLength(1);
        expect(body.data.teams[0]).toMatchObject({
          id: teamId(RegistrationStatus.APPROVED),
          name: 'Security team APPROVED',
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          rejectReason: null,
          captain: { displayName: 'Security test captain' },
          _count: { members: 1 },
        });
        expect(JSON.stringify(body)).not.toContain(
          'private-representative@example.com',
        );
        expect(JSON.stringify(body)).not.toContain(
          'private-member@example.com',
        );
      }
    },
  );

  it.each([undefined, 'outsider', 'referee', 'admin'] as const)(
    'denies pending and rejected team details to %p',
    async (actor) => {
      for (const status of [
        RegistrationStatus.PENDING,
        RegistrationStatus.REJECTED,
      ]) {
        await get(`/api/teams/${teamId(status)}`, actor).expect(404);
      }
    },
  );

  it.each([
    'organizer',
    'captain',
    'member',
    'coOrganizer',
    'overrideAdmin',
  ] as const)('keeps registration details accessible to %s', async (actor) => {
    for (const status of [
      RegistrationStatus.PENDING,
      RegistrationStatus.REJECTED,
    ]) {
      const response = await get(`/api/teams/${teamId(status)}`, actor).expect(
        200,
      );
      expect(response.body).toMatchObject({
        data: {
          status,
          canViewSensitiveInfo: true,
          contactEmail: 'private-representative@example.com',
        },
      });
    }
  });

  it('keeps approved team pages public while hiding contact fields', async () => {
    const response = await get(
      `/api/teams/${teamId(RegistrationStatus.APPROVED)}`,
    ).expect(200);
    expect(response.body).toMatchObject({
      data: {
        status: 'APPROVED',
        canViewSensitiveInfo: false,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        rejectReason: null,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'private-member@example.com',
    );
  });
});
