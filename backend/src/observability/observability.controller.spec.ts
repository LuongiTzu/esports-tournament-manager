import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { configureApp } from '../main';
import { PrismaService } from '../prisma/prisma.service';
import { ImageStorageService } from '../uploads/image-storage.service';
import { ObservabilityController } from './observability.controller';
import { RequestMetricsService } from './request-metrics.service';

describe('metrics authorization', () => {
  let app: INestApplication;
  const config = { get: jest.fn() };
  const metrics = {
    snapshot: jest.fn().mockReturnValue({ uptimeSeconds: 42 }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ObservabilityController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: {} },
        { provide: ImageStorageService, useValue: {} },
        { provide: RequestMetricsService, useValue: metrics },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(() => app.close());

  it.each([undefined, '', '   '])(
    'denies access when METRICS_TOKEN is %p',
    async (token) => {
      config.get.mockReturnValue(token);
      await request(app.getHttpServer() as Server)
        .get('/api/metrics')
        .expect(401);
      await request(app.getHttpServer() as Server)
        .get('/api/metrics')
        .set('Authorization', 'Bearer undefined')
        .expect(401);
      expect(metrics.snapshot).not.toHaveBeenCalled();
    },
  );

  it('requires the configured bearer token', async () => {
    config.get.mockReturnValue('metrics-test-token');
    await request(app.getHttpServer() as Server)
      .get('/api/metrics')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .get('/api/metrics')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);
    expect(metrics.snapshot).not.toHaveBeenCalled();

    const response = await request(app.getHttpServer() as Server)
      .get('/api/metrics')
      .set('Authorization', 'Bearer metrics-test-token')
      .expect(200);
    expect(response.body).toMatchObject({ data: { uptimeSeconds: 42 } });
  });
});
