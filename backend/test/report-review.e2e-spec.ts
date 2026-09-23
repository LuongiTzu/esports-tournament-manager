/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ReportReason, ReportStatus, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('report submission and admin review (database E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let gameId: string;
  let tournamentId: string;
  let slug: string;
  let reporterToken: string;
  let adminToken: string;
  let unverifiedToken: string;
  const userIds: string[] = [];
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let sequence = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendActivity: jest.fn().mockResolvedValue(undefined) })
      .compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
    configureApp(app);
    await app.init();

    const game = await prisma.game.create({
      data: {
        code: `REPORT_E2E_${stamp}`,
        name: `Report E2E ${stamp}`,
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    gameId = game.id;

    for (const [label, role, verified] of [
      ['organizer', Role.SIGNED_UP_USER, true],
      ['reporter', Role.SIGNED_UP_USER, true],
      ['admin', Role.ADMIN, true],
      ['unverified', Role.SIGNED_UP_USER, false],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `report-${label}-${stamp}@example.test`,
          displayName: label,
          role,
          emailVerifiedAt: verified ? new Date() : null,
        },
      });
      userIds.push(user.id);
      const token = jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: 0,
      });
      if (label === 'organizer') organizerId = user.id;
      if (label === 'reporter') reporterToken = token;
      if (label === 'admin') adminToken = token;
      if (label === 'unverified') unverifiedToken = token;
    }
  });

  let organizerId: string;
  beforeEach(async () => {
    slug = `report-e2e-${stamp}-${sequence++}`;
    const tournament = await prisma.tournament.create({
      data: {
        name: slug,
        slug,
        organizerId,
        gameId,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    tournamentId = tournament.id;
  });

  afterEach(async () => {
    if (!tournamentId) return;
    await prisma.notification.deleteMany({ where: { tournamentId } });
    await prisma.tournament.delete({ where: { id: tournamentId } });
    tournamentId = '';
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (gameId) await prisma.game.delete({ where: { id: gameId } });
    }
    if (app) await app.close();
  });

  it('enforces authentication, verification and input validation before creating a report', async () => {
    const endpoint = `/api/tournaments/${slug}/reports`;
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ reason: ReportReason.SCAM })
      .expect(401);
    await request(app.getHttpServer())
      .post(endpoint)
      .auth(unverifiedToken, { type: 'bearer' })
      .send({ reason: ReportReason.SCAM })
      .expect(403);
    await request(app.getHttpServer())
      .post(endpoint)
      .auth(reporterToken, { type: 'bearer' })
      .send({ reason: 'INVALID', description: 'x' })
      .expect(400);
    expect(await prisma.report.count({ where: { tournamentId } })).toBe(0);
  });

  it('creates one active report, lets only admin resolve it and permits a later report', async () => {
    const endpoint = `/api/tournaments/${slug}/reports`;
    const first = await request(app.getHttpServer())
      .post(endpoint)
      .auth(reporterToken, { type: 'bearer' })
      .send({ reason: ReportReason.SCAM, description: ' Suspicious activity ' })
      .expect(201);
    const reportId: string = first.body.data.id;
    expect(first.body.data).toMatchObject({
      reason: ReportReason.SCAM,
      description: 'Suspicious activity',
      status: ReportStatus.PENDING,
      pendingReportCount: 1,
    });

    await request(app.getHttpServer())
      .post(endpoint)
      .auth(reporterToken, { type: 'bearer' })
      .send({ reason: ReportReason.SCAM })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/admin/reports/${reportId}`)
      .auth(reporterToken, { type: 'bearer' })
      .send({ status: ReportStatus.REVIEWED })
      .expect(403);

    const pending = await request(app.getHttpServer())
      .get('/api/admin/reports?status=PENDING')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(pending.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: reportId })]),
    );

    await request(app.getHttpServer())
      .patch(`/api/admin/reports/${reportId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: ReportStatus.REVIEWED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/admin/reports/${reportId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: ReportStatus.DISMISSED })
      .expect(400);

    const saved = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(saved.status).toBe(ReportStatus.REVIEWED);
    expect(saved.reviewedBy).toBe(userIds[2]);
    expect(saved.reviewedAt).toBeInstanceOf(Date);

    await request(app.getHttpServer())
      .post(endpoint)
      .auth(reporterToken, { type: 'bearer' })
      .send({ reason: ReportReason.GAMBLING })
      .expect(201);
    expect(await prisma.report.count({ where: { tournamentId } })).toBe(2);
  });
});
