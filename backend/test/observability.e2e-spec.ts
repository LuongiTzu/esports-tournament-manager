import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('health and observability (database E2E)', () => {
  let app: INestApplication;
  const previousMetricsToken = process.env.METRICS_TOKEN;
  const metricsToken = 'observability-e2e-metrics-token';

  beforeAll(async () => {
    process.env.METRICS_TOKEN = metricsToken;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (previousMetricsToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previousMetricsToken;
  });

  it('exposes liveness with a traceable request id', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health/live')
      .set('x-request-id', 'e2e-health-request')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('e2e-health-request');
    expect(response.body).toMatchObject({ data: { status: 'ok' } });
  });

  it('reports database and storage readiness', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health/ready')
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        status: 'ready',
        checks: { database: 'up', storage: 'up' },
      },
    });
  });

  it('requires authentication before publishing aggregate process metrics', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/metrics')
      .expect(401);
    const response = await request(app.getHttpServer() as Server)
      .get('/api/metrics')
      .set('Authorization', `Bearer ${metricsToken}`)
      .expect(200);

    const body = response.body as {
      data: {
        requests: { total: number };
        process: { heapUsedBytes: number };
      };
    };
    expect(body.data.requests.total).toBeGreaterThanOrEqual(2);
    expect(body.data.process.heapUsedBytes).toBeGreaterThan(0);
  });
});
