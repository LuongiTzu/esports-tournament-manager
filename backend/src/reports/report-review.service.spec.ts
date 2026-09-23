/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportReviewService } from './report-review.service';

function harness() {
  const prisma = {
    report: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'report-1',
        status: ReportStatus.PENDING,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'report-1',
        status: ReportStatus.REVIEWED,
      }),
    },
  } as unknown as PrismaService;
  return { service: new ReportReviewService(prisma), prisma };
}

describe('ReportReviewService', () => {
  it('filters reports by status and includes the people and tournament needed for review', async () => {
    const { service, prisma } = harness();

    await service.list(ReportStatus.PENDING);

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ReportStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: expect.objectContaining({
          tournament: expect.any(Object),
          reporter: expect.any(Object),
          reviewer: expect.any(Object),
        }),
      }),
    );
  });

  it('rejects pending as a review outcome without touching the database', async () => {
    const { service, prisma } = harness();

    await expect(
      service.review('report-1', ReportStatus.PENDING, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.report.findUnique).not.toHaveBeenCalled();
    expect(prisma.report.update).not.toHaveBeenCalled();
  });

  it('rejects missing and already resolved reports without overwriting a decision', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.report.findUnique).mockResolvedValueOnce(null);
    await expect(
      service.review('missing', ReportStatus.REVIEWED, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    jest.mocked(prisma.report.findUnique).mockResolvedValueOnce({
      id: 'report-1',
      status: ReportStatus.DISMISSED,
    } as never);
    await expect(
      service.review('report-1', ReportStatus.REVIEWED, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.report.update).not.toHaveBeenCalled();
  });

  it('records the admin and timestamp when resolving a pending report', async () => {
    const { service, prisma } = harness();

    await service.review('report-1', ReportStatus.DISMISSED, 'admin-1');

    expect(prisma.report.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: {
        status: ReportStatus.DISMISSED,
        reviewedAt: expect.any(Date),
        reviewedBy: 'admin-1',
      },
    });
  });
});
