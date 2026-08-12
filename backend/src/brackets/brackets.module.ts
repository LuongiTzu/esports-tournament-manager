import { Module } from '@nestjs/common';
import { RoundSettingsService } from './round-settings.service';

/**
 * Module Bracket — chứa toàn bộ logic sinh bracket & chuẩn hóa settings.
 *
 * GĐ 5.1: RoundSettingsService (validate/normalize settings theo format).
 * GĐ 5.2+: các generator (round-robin, group-stage, swiss, playoff, double-elim)
 * cùng BracketsService, BracketsController.
 *
 * `exports` giúp các module khác (vd. TournamentsModule khi tạo Round)
 * dùng được RoundSettingsService.
 */
@Module({
  providers: [RoundSettingsService],
  exports: [RoundSettingsService],
})
export class BracketsModule {}
