import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestMetricsService } from './request-metrics.service';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: RequestMetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    const finishMetrics = this.metrics.start();
    response.setHeader('x-request-id', requestId);

    response.once('finish', () => {
      const durationMs = finishMetrics();
      this.metrics.recordStatus(response.statusCode);
      const log = JSON.stringify({
        event: 'http_request',
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        contentLength: Number(response.getHeader('content-length') ?? 0),
      });
      if (response.statusCode >= 500) this.logger.error(log);
      else if (response.statusCode >= 400) this.logger.warn(log);
      else this.logger.log(log);
    });

    next();
  }
}
