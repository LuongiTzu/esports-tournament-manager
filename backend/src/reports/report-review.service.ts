import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportReviewService {
  constructor(private readonly prisma: PrismaService) {}
  list(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        tournament: { select: { id: true, name: true, slug: true } },
        reporter: { select: { id: true, displayName: true } },
        reviewer: { select: { id: true, displayName: true } },
      },
    });
  }
  async review(id: string, status: ReportStatus, adminId: string) {
    if (status === ReportStatus.PENDING)
      throw new BadRequestException('Report can only be REVIEWED or DISMISSED');
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.PENDING)
      throw new BadRequestException('Only PENDING reports may be reviewed');
    return this.prisma.report.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedBy: adminId },
    });
  }
}
