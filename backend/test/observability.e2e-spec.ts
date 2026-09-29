import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('health and observability (database E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes liveness with a traceable request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/live')
      .set('x-request-id', 'e2e-health-request')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('e2e-health-request');
    expect(response.body.data).toMatchObject({ status: 'ok' });
  });

  it('reports database and storage readiness', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200);

    expect(response.body.data).toEqual({
      status: 'ready',
      checks: { database: 'up', storage: 'up' },
    });
  });

  it('publishes aggregate process metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/metrics')
      .expect(200);

    expect(response.body.data.requests.total).toBeGreaterThanOrEqual(2);
    expect(response.body.data.process.heapUsedBytes).toBeGreaterThan(0);
  });
});
