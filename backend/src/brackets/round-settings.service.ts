import { BadRequestException, Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import { validate } from 'class-validator';
import {
  DEFAULT_ROUND_SETTINGS,
  GroupStageSettings,
  RoundRobinSettings,
  RoundSettingsMap,
} from './types/round-settings';
import { createSettingsDtoForFormat } from './dto/round-settings.dto';

/**
 * Service chuẩn hóa & validate `Round.settings` theo từng thể thức.
 *
 * Trách nhiệm:
 *  - Điền giá trị mặc định nếu FE không gửi `settings`
 *  - Validate các field theo đúng schema của từng format
 *  - Trả về settings đã "chuẩn hóa" (đầy đủ + hợp lệ) để lưu vào DB
 *
 * Đây là tầng domain — không phụ thuộc Prisma, tách biệt với controller/service
 * của Tournament. Điều này giúp các generator (GĐ 5.2+) đọc settings an toàn.
 */
@Injectable()
export class RoundSettingsService {
  /**
   * Chuẩn hóa settings cho một round.
   * Nếu settings rỗng → dùng defaults của format.
   * Nếu có settings → validate, nếu lỗi ném BadRequestException.
   */
  async normalizeForFormat(
    format: RoundFormat,
    settings?: Record<string, unknown> | null,
  ): Promise<RoundSettingsMap[RoundFormat]> {
    const defaults = DEFAULT_ROUND_SETTINGS[format];

    if (!defaults) {
      throw new BadRequestException(`Không hỗ trợ format: ${String(format)}`);
    }

    // Không có settings → trả defaults (clone để tránh mutate object dùng chung)
    if (!settings || Object.keys(settings).length === 0) {
      return cloneJson(defaults);
    }

    // Merge settings gửi lên với defaults (chỉ ghi đè field có giá trị)
    const supplied = Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== undefined),
    );
    const canonical = canonicalizeSettings(format, supplied);
    const merged = { ...defaults, ...canonical };

    // Validate bằng DTO riêng theo format
    const dtoInstance = createSettingsDtoForFormat(format, merged);
    const errors = await validate(dtoInstance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}),
      );
      throw new BadRequestException(messages);
    }

    this.validateCombinations(format, merged);

    return cloneJson(merged);
  }

  /**
   * Lấy settings đã lưu của một round, đảm bảo đầy đủ defaults.
   * Dùng trong các generator khi đọc `Round.settings` từ DB.
   */
  getEffectiveSettings(
    format: RoundFormat,
    storedSettings?: unknown,
  ): RoundSettingsMap[RoundFormat] {
    const defaults = DEFAULT_ROUND_SETTINGS[format];
    if (!storedSettings || typeof storedSettings !== 'object') {
      return cloneJson(defaults);
    }
    const stored = storedSettings as Record<string, unknown>;
    const canonical = canonicalizeSettings(
      format,
      Object.fromEntries(
        Object.entries(stored).filter(([, value]) => value !== undefined),
      ),
    );
    const isLegacyGroupStage =
      format === RoundFormat.GROUP_STAGE &&
      stored.allowDraws === undefined &&
      ['numGroups', 'teamsPerGroup', 'advanceCount', 'doubleRound'].some(
        (key) => Object.prototype.hasOwnProperty.call(stored, key),
      );
    return cloneJson({
      ...defaults,
      ...canonical,
      // Legacy Group Stage rounds historically accepted draws. New rounds are
      // persisted with the explicit default `allowDraws: false`.
      ...(isLegacyGroupStage ? { allowDraws: true } : {}),
    });
  }

  private validateCombinations(
    format: RoundFormat,
    settings: RoundSettingsMap[RoundFormat],
  ): void {
    if (format === RoundFormat.GROUP_STAGE) {
      const groupSettings = settings as GroupStageSettings;
      if (groupSettings.winPoints <= groupSettings.lossPoints) {
        throw new BadRequestException('winPoints phải lớn hơn lossPoints');
      }
      if (
        groupSettings.allowDraws &&
        (groupSettings.winPoints <= groupSettings.drawPoints ||
          groupSettings.drawPoints < groupSettings.lossPoints)
      ) {
        throw new BadRequestException(
          'Khi cho phép hòa, điểm phải thỏa winPoints > drawPoints >= lossPoints',
        );
      }
    }

    if (format === RoundFormat.ROUND_ROBIN) {
      const pointSettings = settings as RoundRobinSettings;
      if (pointSettings.winPoints <= pointSettings.lossPoints) {
        throw new BadRequestException('winPoints phải lớn hơn lossPoints');
      }
      if (
        pointSettings.allowDraws &&
        (pointSettings.winPoints <= pointSettings.drawPoints ||
          pointSettings.drawPoints < pointSettings.lossPoints)
      ) {
        throw new BadRequestException(
          'Khi cho phép hòa, điểm phải thỏa winPoints > drawPoints >= lossPoints',
        );
      }
    }
  }
}

function canonicalizeSettings(
  format: RoundFormat,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  if (format === RoundFormat.PLAYOFF || format === RoundFormat.DOUBLE_ELIM) {
    const canonical = { ...settings };
    // Seeding is fixed engine behavior, not a configurable round setting.
    // Accept historical JSON containing the old marker but never expose it.
    delete canonical.seeding;
    return canonical;
  }
  if (format === RoundFormat.SWISS) {
    const canonical = { ...settings };
    if (
      canonical.numberOfRounds === undefined &&
      canonical.numRounds !== undefined
    ) {
      canonical.numberOfRounds = canonical.numRounds;
    }
    if (
      canonical.advancingTeamCount === undefined &&
      canonical.advanceCount !== undefined
    ) {
      canonical.advancingTeamCount = canonical.advanceCount;
    }
    delete canonical.numRounds;
    delete canonical.advanceCount;
    delete canonical.pointsWin;
    delete canonical.pointsDraw;
    delete canonical.pointsLoss;
    delete canonical.tiebreakers;
    return canonical;
  }
  if (
    format !== RoundFormat.ROUND_ROBIN &&
    format !== RoundFormat.GROUP_STAGE
  ) {
    return settings;
  }

  const canonical = { ...settings };
  if (
    format === RoundFormat.GROUP_STAGE &&
    canonical.numberOfGroups === undefined &&
    canonical.numGroups !== undefined
  ) {
    canonical.numberOfGroups = canonical.numGroups;
  }
  if (
    format === RoundFormat.GROUP_STAGE &&
    canonical.advancingTeamsPerGroup === undefined &&
    canonical.advanceCount !== undefined
  ) {
    canonical.advancingTeamsPerGroup = canonical.advanceCount;
  }
  if (canonical.winPoints === undefined && canonical.pointsWin !== undefined) {
    canonical.winPoints = canonical.pointsWin;
  }
  if (
    canonical.drawPoints === undefined &&
    canonical.pointsDraw !== undefined
  ) {
    canonical.drawPoints = canonical.pointsDraw;
  }
  if (
    canonical.lossPoints === undefined &&
    canonical.pointsLoss !== undefined
  ) {
    canonical.lossPoints = canonical.pointsLoss;
  }
  if (
    canonical.meetingsPerPair === undefined &&
    canonical.doubleRound !== undefined
  ) {
    canonical.meetingsPerPair = canonical.doubleRound === true ? 2 : 1;
  }
  delete canonical.pointsWin;
  delete canonical.pointsDraw;
  delete canonical.pointsLoss;
  delete canonical.doubleRound;
  delete canonical.numGroups;
  delete canonical.teamsPerGroup;
  delete canonical.advanceCount;
  return canonical;
}

/** Clone các object JSON để không làm lộ tham chiếu tới defaults/input dùng chung. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
