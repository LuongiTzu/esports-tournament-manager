import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportService } from './report.service';

@ApiTags('reports')
@Controller('tournaments')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':slug/reports')
  create(
    @Param('slug') slug: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.reports.create(slug, dto, user?.id);
  }
}
