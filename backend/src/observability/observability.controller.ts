import {
  Controller,
  Get,
  Header,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ImageStorageService } from '../uploads/image-storage.service';
import { RequestMetricsService } from './request-metrics.service';

@Controller()
export class ObservabilityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorageService,
    private readonly metrics: RequestMetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get('health/live')
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    const [database, storage] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storage.checkHealth(),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      storage: storage.status === 'fulfilled' ? 'up' : 'down',
    };
    if (database.status === 'rejected' || storage.status === 'rejected') {
      throw new ServiceUnavailableException({
        message: 'Service dependencies are not ready',
        details: { checks },
      });
    }
    return { status: 'ready', checks };
  }

  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  metricsSnapshot(@Headers('authorization') authorization?: string) {
    const metricsToken = this.config.get<string>('METRICS_TOKEN');
    if (metricsToken && authorization !== `Bearer ${metricsToken}`) {
      throw new UnauthorizedException('Metrics token không hợp lệ');
    }
    return this.metrics.snapshot();
  }
}
