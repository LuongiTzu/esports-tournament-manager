/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { configureApp } from '../main';

@Controller('rate-test')
class RateTestController {
  @Post()
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  write() {
    return { ok: true };
  }

  @Get()
  read() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [RateTestController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class RateTestModule {}

async function createApp(trustProxyHops: '0' | '1') {
  const moduleRef = await Test.createTestingModule({
    imports: [RateTestModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  const previous = process.env.TRUST_PROXY_HOPS;
  try {
    process.env.TRUST_PROXY_HOPS = trustProxyHops;
    configureApp(app);
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = previous;
  }
  await app.init();
  return app;
}

describe('application rate limiting', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp('0');
  });

  afterEach(() => app.close());

  it('allows requests below the endpoint limit and returns HTTP 429 above it', async () => {
    await request(app.getHttpServer()).post('/api/rate-test').expect(201);
    await request(app.getHttpServer()).post('/api/rate-test').expect(201);
    await request(app.getHttpServer()).post('/api/rate-test').expect(429);
  });

  it('keeps normal public GET requests usable under the global default', async () => {
    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer()).get('/api/rate-test').expect(200);
    }
  });

  it('ignores forged forwarding headers on a direct deployment', async () => {
    for (const [ip, status] of [
      ['198.51.100.1', 201],
      ['198.51.100.2', 201],
      ['198.51.100.3', 429],
    ] as const) {
      await request(app.getHttpServer())
        .post('/api/rate-test')
        .set('X-Forwarded-For', ip)
        .expect(status);
    }
  });
});

describe('rate limiting behind the production gateway', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp('1');
  });

  afterEach(() => app.close());

  it('keeps different clients in separate rate-limit buckets', async () => {
    for (const status of [201, 201, 429]) {
      await request(app.getHttpServer())
        .post('/api/rate-test')
        .set('X-Forwarded-For', '198.51.100.1')
        .expect(status);
    }
    await request(app.getHttpServer())
      .post('/api/rate-test')
      .set('X-Forwarded-For', '198.51.100.2')
      .expect(201);
  });

  it('does not trust an extra client-supplied hop', async () => {
    for (const [forgedIp, status] of [
      ['203.0.113.1', 201],
      ['203.0.113.2', 201],
      ['203.0.113.3', 429],
    ] as const) {
      await request(app.getHttpServer())
        .post('/api/rate-test')
        .set('X-Forwarded-For', `${forgedIp}, 198.51.100.1`)
        .expect(status);
    }
  });
});
