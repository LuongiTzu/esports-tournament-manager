/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import { ContentFilterService } from '../src/common/services/content-filter.service';

const databaseDescribe =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;
databaseDescribe('tournament ratings (real PostgreSQL)', () => {
  let app: INestApplication, prisma: PrismaService;
  const users: Record<string, { id: string; token: string }> = {};
  const tournamentIds: string[] = [];
  const stamp = Date.now();
  let slug: string, tournamentId: string, teamId: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendActivity: async () => {} })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = module.get(PrismaService);
    const jwt = module.get(JwtService);
    for (const name of [
      'organizer',
      'captain',
      'member',
      'outsider',
      'admin',
    ]) {
      const user = await prisma.user.create({
        data: {
          email: `rating-${stamp}-${name}@example.test`,
          displayName: name,
          role: name === 'admin' ? 'ADMIN' : 'SIGNED_UP_USER',
          emailVerifiedAt: new Date(),
        },
      });
      users[name] = {
        id: user.id,
        token: jwt.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
          tokenVersion: 0,
        }),
      };
    }
  });
  beforeEach(async () => {
    const game = await prisma.game.findFirstOrThrow();
    slug = `ratings-${stamp}-${tournamentIds.length}`;
    const tournament = await prisma.tournament.create({
      data: {
        slug,
        name: slug,
        gameId: game.id,
        organizerId: users.organizer.id,
        status: 'COMPLETED',
        minTeamSize: 1,
        maxTeamSize: 2,
      },
    });
    tournamentId = tournament.id;
    tournamentIds.push(tournamentId);
    const team = await prisma.team.create({
      data: {
        name: 'Rated team',
        tournamentId,
        captainId: users.captain.id,
        contactName: 'Captain',
        contactEmail: 'captain@example.test',
        status: 'APPROVED',
        members: {
          create: {
            userId: users.member.id,
            realName: 'Member',
            ign: 'Member',
          },
        },
      },
    });
    teamId = team.id;
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.tournament.deleteMany({
        where: { id: { in: tournamentIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(users).map((u) => u.id) } },
      });
    }
    if (app) await app.close();
  });
  const endpoint = () => `/api/tournaments/${slug}/ratings`;
  const post = (name: string, score = 4) =>
    request(app.getHttpServer())
      .post(endpoint())
      .auth(users[name].token, { type: 'bearer' })
      .send({ score, content: 'Good tournament' });
  const list = () => request(app.getHttpServer()).get(endpoint());

  it('allows approved captains and linked members, and rejects ineligible accounts', async () => {
    await post('organizer').expect(403);
    await post('outsider').expect(403);
    await request(app.getHttpServer())
      .post(endpoint())
      .send({ score: 5 })
      .expect(401);
    await prisma.user.update({
      where: { id: users.member.id },
      data: { emailVerifiedAt: null },
    });
    await post('member').expect(403);
    await prisma.user.update({
      where: { id: users.member.id },
      data: { emailVerifiedAt: new Date() },
    });
    await prisma.team.update({
      where: { id: teamId },
      data: { status: 'PENDING' },
    });
    await post('captain').expect(403);
    await prisma.team.update({
      where: { id: teamId },
      data: { status: 'APPROVED' },
    });
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'ONGOING' },
    });
    await post('captain').expect(403);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'COMPLETED' },
    });
    await post('captain', 5).expect(201);
    await post('member', 3).expect(201);
    expect((await list().expect(200)).body.data.summary).toEqual({
      average: 4,
      count: 2,
    });
  });
  it('enforces one rating under concurrent requests and validates score/content', async () => {
    for (const score of [0, 6, 2.5]) await post('captain', score).expect(400);
    await request(app.getHttpServer())
      .post(endpoint())
      .auth(users.captain.token, { type: 'bearer' })
      .send({ score: 5, content: 'a'.repeat(2001) })
      .expect(400);
    const results = await Promise.all([post('captain', 5), post('captain', 4)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.tournamentRating.count({ where: { tournamentId } }),
    ).toBe(1);
    await expect(
      prisma.tournamentRating.updateMany({
        where: { tournamentId },
        data: { score: 9 },
      }),
    ).rejects.toThrow();
  });
  it('updates/removes only the current author and paginates visible ratings', async () => {
    await post('captain', 5).expect(201);
    await post('member', 1).expect(201);
    await request(app.getHttpServer())
      .patch(`${endpoint()}/me`)
      .auth(users.outsider.token, { type: 'bearer' })
      .send({ score: 4 })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`${endpoint()}/me`)
      .auth(users.outsider.token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${endpoint()}/me`)
      .auth(users.captain.token, { type: 'bearer' })
      .send({ score: 3, content: '' })
      .expect(200);
    const page = await request(app.getHttpServer())
      .get(`${endpoint()}?limit=1&page=2`)
      .expect(200);
    expect(page.body.data.data).toHaveLength(1);
    expect(page.body.data.summary).toEqual({ average: 2, count: 2 });
    await request(app.getHttpServer())
      .delete(`${endpoint()}/me`)
      .auth(users.member.token, { type: 'bearer' })
      .expect(200);
    expect((await list()).body.data.summary).toEqual({ average: 3, count: 1 });
  });
  it('moderates only as admin, preserves hiding on edit, and recomputes aggregates', async () => {
    const created = await post('captain', 5).expect(201);
    await post('member', 1).expect(201);
    const moderation = `/api/admin/ratings/${created.body.data.id}/moderation`;
    await request(app.getHttpServer())
      .patch(moderation)
      .auth(users.organizer.token, { type: 'bearer' })
      .send({ isHidden: true, reason: 'Abuse' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(moderation)
      .auth(users.admin.token, { type: 'bearer' })
      .send({ isHidden: true, reason: ' ' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(moderation)
      .auth(users.admin.token, { type: 'bearer' })
      .send({ isHidden: true, reason: 'Abuse' })
      .expect(200);
    expect((await list()).body.data.summary).toEqual({ average: 1, count: 1 });
    const mine = await request(app.getHttpServer())
      .get(endpoint())
      .auth(users.captain.token, { type: 'bearer' })
      .expect(200);
    expect(mine.body.data.mine.isHidden).toBe(true);
    expect(mine.body.data.mine.moderationReason).toBe('Abuse');
    await request(app.getHttpServer())
      .patch(`${endpoint()}/me`)
      .auth(users.captain.token, { type: 'bearer' })
      .send({ score: 3 })
      .expect(200);
    expect((await list()).body.data.summary.count).toBe(1);
    await request(app.getHttpServer())
      .patch(moderation)
      .auth(users.admin.token, { type: 'bearer' })
      .send({ isHidden: false })
      .expect(200);
    expect((await list()).body.data.summary).toEqual({ average: 2, count: 2 });
    await request(app.getHttpServer())
      .get('/api/admin/ratings')
      .auth(users.outsider.token, { type: 'bearer' })
      .expect(403);
  });
  it('protects private and admin-hidden tournaments on reads and writes', async () => {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { visibility: 'PRIVATE' },
    });
    await list().expect(404);
    await request(app.getHttpServer())
      .get(endpoint())
      .auth(users.outsider.token, { type: 'bearer' })
      .expect(404);
    await post('captain').expect(201);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { moderationStatus: 'HIDDEN_BY_ADMIN' },
    });
    await request(app.getHttpServer())
      .get(endpoint())
      .auth(users.captain.token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${endpoint()}/me`)
      .auth(users.captain.token, { type: 'bearer' })
      .send({ score: 3 })
      .expect(404);
    await request(app.getHttpServer())
      .get(endpoint())
      .auth(users.admin.token, { type: 'bearer' })
      .expect(200);
  });
  it('rejects prohibited review text using the existing content filter', async () => {
    const keyword = await prisma.bannedKeyword.create({
      data: { keyword: `ratingbanned${stamp}`, category: 'PROFANITY' },
    });
    try {
      await app.get(ContentFilterService).refresh();
      await request(app.getHttpServer())
        .post(endpoint())
        .auth(users.captain.token, { type: 'bearer' })
        .send({ score: 4, content: keyword.keyword })
        .expect(400);
      expect(
        await prisma.tournamentRating.count({ where: { tournamentId } }),
      ).toBe(0);
    } finally {
      await prisma.bannedKeyword.delete({ where: { id: keyword.id } });
      await app.get(ContentFilterService).refresh();
    }
  });
});
