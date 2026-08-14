import { BadRequestException, Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import { validate } from 'class-validator';
import {
  DEFAULT_ROUND_SETTINGS,
  GroupStageSettings,
  RoundRobinSettings,
  RoundSettingsMap,
  SwissSettings,
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
    const merged = { ...defaults, ...supplied };

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
    return cloneJson({
      ...defaults,
      ...Object.fromEntries(
        Object.entries(storedSettings as Record<string, unknown>).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    });
  }

  private validateCombinations(
    format: RoundFormat,
    settings: RoundSettingsMap[RoundFormat],
  ): void {
    if (format === RoundFormat.GROUP_STAGE) {
      const groupSettings = settings as GroupStageSettings;
      if (groupSettings.advanceCount > groupSettings.teamsPerGroup) {
        throw new BadRequestException(
          'advanceCount không được lớn hơn teamsPerGroup',
        );
      }
    }

    if (
      format === RoundFormat.ROUND_ROBIN ||
      format === RoundFormat.GROUP_STAGE ||
      format === RoundFormat.SWISS
    ) {
      const pointSettings = settings as RoundRobinSettings | SwissSettings;
      if (
        pointSettings.pointsWin <= pointSettings.pointsDraw ||
        pointSettings.pointsDraw < pointSettings.pointsLoss
      ) {
        throw new BadRequestException(
          'Cấu hình điểm phải thỏa pointsWin > pointsDraw >= pointsLoss',
        );
      }
    }
  }
}

/** Clone các object JSON để không làm lộ tham chiếu tới defaults/input dùng chung. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
