import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { UploadModule } from '../uploads/upload.module';
import { ObservabilityController } from './observability.controller';
import { RequestMetricsService } from './request-metrics.service';
import { RequestObservabilityMiddleware } from './request-observability.middleware';

@Module({
  imports: [UploadModule],
  controllers: [ObservabilityController],
  providers: [RequestMetricsService, RequestObservabilityMiddleware],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestObservabilityMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
