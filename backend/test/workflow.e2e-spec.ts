/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

const runDatabaseE2E = process.env.RUN_DATABASE_E2E === 'true';
const describeDatabase = runDatabaseE2E ? describe : describe.skip;

describeDatabase('main tournament workflow (database E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const organizerEmail = `e2e-organizer-${stamp}@example.com`;
  const participantEmail = `e2e-participant-${stamp}@example.com`;
  let organizerToken: string;
  let participantToken: string;
  let seededParticipantToken: string;
  let gameId: string;
  let tournamentId: string;
  let slug: string;
  let teamId: string;
  let roundId: string;
  let matchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (runDatabaseE2E && prisma) {
      if (tournamentId) {
        await prisma.notification.deleteMany({ where: { tournamentId } });
        await prisma.tournament.deleteMany({ where: { id: tournamentId } });
      }
      await prisma.user.deleteMany({
        where: { email: { in: [organizerEmail, participantEmail] } },
      });
    }
    if (app) await app.close();
  });

  it('registers, logs in, creates a tournament and completes bracket progression', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: organizerEmail,
        password: 'E2ePass123!',
        displayName: 'E2E Organizer',
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: organizerEmail,
        password: 'E2ePass123!',
      })
      .expect(200);
    organizerToken =
      login.body.data.accessToken ?? login.body.data.access_token;

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: participantEmail,
        password: 'E2ePass123!',
        displayName: 'E2E Participant',
      })
      .expect(201);
    const participantLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: participantEmail,
        password: 'E2ePass123!',
      })
      .expect(200);
    participantToken =
      participantLogin.body.data.accessToken ??
      participantLogin.body.data.access_token;

    const seededParticipantLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'kai.tran@seed.esports.test',
        password: '12345678',
      })
      .expect(200);
    seededParticipantToken =
      seededParticipantLogin.body.data.accessToken ??
      seededParticipantLogin.body.data.access_token;

    const games = await request(app.getHttpServer())
      .get('/api/games')
      .expect(200);
    gameId = games.body.data.find(
      (game: { name: string }) => game.name === 'Tekken 8',
    ).id;
    const tournament = await request(app.getHttpServer())
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: `E2E Cup ${stamp}`,
        gameId,
        visibility: 'PUBLIC',
        maxTeamSize: 1,
        requireMemberFullInfo: false,
      })
      .expect(201);
    tournamentId = tournament.body.data.id;
    slug = tournament.body.data.slug;

    const teamBody = (
      name: string,
      ign: string,
      contactName: string,
      contactEmail: string,
    ) => ({
      name,
      contactName,
      contactEmail,
      contactPhone: '0900000000',
      members: [{ realName: name, ign, email: contactEmail }],
    });
    await request(app.getHttpServer())
      .post(`/api/tournaments/${slug}/register`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(
        teamBody(
          `Blocked Organizer Team ${stamp}`,
          `blocked-${stamp}`,
          'E2E Organizer',
          organizerEmail,
        ),
      )
      .expect(400);
    const registered = await request(app.getHttpServer())
      .post(`/api/tournaments/${slug}/register`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send(
        teamBody(
          `E2E Team A ${stamp}`,
          `a-${stamp}`,
          'E2E Participant',
          participantEmail,
        ),
      )
      .expect(201);
    teamId = registered.body.data.id;
    await request(app.getHttpServer())
      .patch(`/api/teams/${teamId}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/tournaments/${slug}/teams`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(
        teamBody(
          `E2E Team B ${stamp}`,
          `b-${stamp}`,
          'E2E Organizer',
          organizerEmail,
        ),
      )
      .expect(201);

    const round = await request(app.getHttpServer())
      .post(`/api/tournaments/${slug}/rounds`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Final', format: 'PLAYOFF', bestOf: 1 })
      .expect(201);
    roundId = round.body.data.id;
    await request(app.getHttpServer())
      .post(`/api/rounds/${roundId}/generate`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(201);
    const bracket = await request(app.getHttpServer())
      .get(`/api/rounds/${roundId}/bracket`)
      .expect(200);
    matchId = bracket.body.data.matches[0].id;
    const completed = await request(app.getHttpServer())
      .put(`/api/matches/${matchId}/scores`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ scores: [{ setNumber: 1, teamAScore: 1, teamBScore: 0 }] })
      .expect(200);
    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.winnerTeamId).toBeTruthy();
  });

  it('rejects unauthorized mutation and protects private tournament reads', async () => {
    await request(app.getHttpServer())
      .patch(`/api/tournaments/${tournamentId}`)
      .send({ name: 'Denied' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ visibility: 'PRIVATE' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/tournaments/${slug}`)
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/tournaments/${slug}`)
      .set('Authorization', `Bearer ${seededParticipantToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/tournaments/${slug}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);
  });
});
