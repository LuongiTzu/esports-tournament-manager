import { RequestMetricsService } from './request-metrics.service';

describe('RequestMetricsService', () => {
  it('records aggregate request status and timing without route labels', () => {
    const service = new RequestMetricsService();
    const finish = service.start();
    finish();
    service.recordStatus(200);

    expect(service.snapshot()).toMatchObject({
      requests: {
        total: 1,
        inFlight: 0,
        byStatus: { 200: 1 },
      },
    });
  });
});
