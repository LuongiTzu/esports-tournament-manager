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

describe('application rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('allows requests below the endpoint limit and returns HTTP 429 above it', async () => {
    await request(app.getHttpServer()).post('/rate-test').expect(201);
    await request(app.getHttpServer()).post('/rate-test').expect(201);
    await request(app.getHttpServer()).post('/rate-test').expect(429);
  });

  it('keeps normal public GET requests usable under the global default', async () => {
    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer()).get('/rate-test').expect(200);
    }
  });
});
