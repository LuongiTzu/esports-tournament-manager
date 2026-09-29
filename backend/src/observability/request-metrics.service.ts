import { Injectable } from '@nestjs/common';

@Injectable()
export class RequestMetricsService {
  private readonly startedAt = Date.now();
  private readonly byStatus = new Map<number, number>();
  private totalRequests = 0;
  private totalDurationMs = 0;
  private inFlight = 0;

  start(): () => number {
    this.inFlight += 1;
    const startedAt = performance.now();
    return () => {
      this.inFlight = Math.max(0, this.inFlight - 1);
      const durationMs = performance.now() - startedAt;
      this.totalDurationMs += durationMs;
      return durationMs;
    };
  }

  recordStatus(statusCode: number): void {
    this.totalRequests += 1;
    this.byStatus.set(statusCode, (this.byStatus.get(statusCode) ?? 0) + 1);
  }

  snapshot() {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      requests: {
        total: this.totalRequests,
        inFlight: this.inFlight,
        averageDurationMs:
          this.totalRequests === 0
            ? 0
            : Number((this.totalDurationMs / this.totalRequests).toFixed(2)),
        byStatus: Object.fromEntries(
          [...this.byStatus.entries()].sort(([left], [right]) => left - right),
        ),
      },
      process: {
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
      },
    };
  }
}
