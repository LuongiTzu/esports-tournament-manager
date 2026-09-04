import { IsBoolean, IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';
import { RoundFormat } from '@prisma/client';
import {
  MATCH_SCORING_MODES,
  MatchScoringMode,
} from '../../common/domain/match-scoring';

/**
 * DTO validate `Round.settings` theo từng thể thức.
 *
 * Vì `settings` được gửi dưới dạng JSON object, ta không thể dùng một DTO tĩnh duy nhất.
 * Thay vào đó: mỗi thể thức có một DTO riêng, và `RoundSettingsDto` là wrapper chọn
 * đúng DTO dựa trên `format` (factory pattern). Điều này giữ cho validation rõ ràng,
 * tách biệt theo từng nghiệp vụ — đúng tinh thần clean architecture.
 */

/** Vòng tròn tính điểm */
class MatchScoringSettingsDto {
  @IsIn(MATCH_SCORING_MODES, {
    message: 'scoringMode must be SERIES_SCORE or POINT_SCORE',
  })
  scoringMode!: MatchScoringMode;
}

export class RoundRobinSettingsDto extends MatchScoringSettingsDto {
  @IsInt({ message: 'advancingTeamCount phải là số nguyên' })
  @Min(1, { message: 'advancingTeamCount tối thiểu là 1' })
  @Max(256, { message: 'advancingTeamCount tối đa là 256' })
  advancingTeamCount!: number;

  @IsInt({ message: 'winPoints phải là số nguyên' })
  @Min(0, { message: 'winPoints không được âm' })
  @Max(100, { message: 'winPoints tối đa là 100' })
  winPoints!: number;

  @IsInt({ message: 'drawPoints phải là số nguyên' })
  @Min(0, { message: 'drawPoints không được âm' })
  @Max(100, { message: 'drawPoints tối đa là 100' })
  drawPoints!: number;

  @IsInt({ message: 'lossPoints phải là số nguyên' })
  @Min(0, { message: 'lossPoints không được âm' })
  @Max(100, { message: 'lossPoints tối đa là 100' })
  lossPoints!: number;

  @IsBoolean({ message: 'allowDraws phải là boolean' })
  allowDraws!: boolean;

  @IsInt({ message: 'meetingsPerPair phải là số nguyên' })
  @Min(1, { message: 'meetingsPerPair tối thiểu là 1' })
  @Max(4, { message: 'meetingsPerPair tối đa là 4' })
  meetingsPerPair!: number;
}

/** Vòng bảng */
export class GroupStageSettingsDto extends MatchScoringSettingsDto {
  @IsInt({ message: 'numberOfGroups phải là số nguyên' })
  @Min(2, { message: 'numberOfGroups tối thiểu là 2' })
  @Max(16, { message: 'numberOfGroups tối đa là 16' })
  numberOfGroups!: number;

  @IsInt({ message: 'advancingTeamsPerGroup phải là số nguyên' })
  @Min(1, { message: 'advancingTeamsPerGroup tối thiểu là 1' })
  advancingTeamsPerGroup!: number;

  @IsInt({ message: 'winPoints phải là số nguyên' })
  @Min(0, { message: 'winPoints không được âm' })
  @Max(100, { message: 'winPoints tối đa là 100' })
  winPoints!: number;

  @IsInt({ message: 'drawPoints phải là số nguyên' })
  @Min(0, { message: 'drawPoints không được âm' })
  @Max(100, { message: 'drawPoints tối đa là 100' })
  drawPoints!: number;

  @IsInt({ message: 'lossPoints phải là số nguyên' })
  @Min(0, { message: 'lossPoints không được âm' })
  @Max(100, { message: 'lossPoints tối đa là 100' })
  lossPoints!: number;

  @IsBoolean({ message: 'allowDraws phải là boolean' })
  allowDraws!: boolean;

  @IsInt({ message: 'meetingsPerPair phải là số nguyên' })
  @Min(1, { message: 'meetingsPerPair tối thiểu là 1' })
  @Max(4, { message: 'meetingsPerPair tối đa là 4' })
  meetingsPerPair!: number;
}

/** Thụy Sĩ */
export class SwissSettingsDto extends MatchScoringSettingsDto {
  @IsOptional()
  @IsInt({ message: 'numberOfRounds phải là số nguyên' })
  @Min(1, { message: 'numberOfRounds tối thiểu là 1' })
  @Max(20, { message: 'numberOfRounds tối đa là 20' })
  numberOfRounds!: number | null;

  @IsInt({ message: 'advancingTeamCount phải là số nguyên' })
  @Min(1, { message: 'advancingTeamCount tối thiểu là 1' })
  @Max(256, { message: 'advancingTeamCount tối đa là 256' })
  advancingTeamCount!: number;
}

/** Playoff — Single Elimination */
export class PlayoffSettingsDto extends MatchScoringSettingsDto {
  @IsBoolean({ message: 'thirdPlaceMatch phải là boolean' })
  thirdPlaceMatch!: boolean;
}

/** Double Elimination */
export class DoubleElimSettingsDto extends MatchScoringSettingsDto {
  @IsBoolean({ message: 'grandFinalReset phải là boolean' })
  grandFinalReset!: boolean;
}

/** Map format → DTO class tương ứng (dùng cho factory) */
export const ROUND_SETTINGS_DTO_MAP = {
  [RoundFormat.ROUND_ROBIN]: RoundRobinSettingsDto,
  [RoundFormat.GROUP_STAGE]: GroupStageSettingsDto,
  [RoundFormat.SWISS]: SwissSettingsDto,
  [RoundFormat.PLAYOFF]: PlayoffSettingsDto,
  [RoundFormat.DOUBLE_ELIM]: DoubleElimSettingsDto,
} as const;

/**
 * Trả về instance DTO phù hợp cho một format nhất định.
 * Dùng trong service để validate/hợp nhất settings khi tạo round.
 */
export function createSettingsDtoForFormat(
  format: RoundFormat,
  settings: Record<string, unknown>,
): object {
  const DtoClass = ROUND_SETTINGS_DTO_MAP[format];
  if (!DtoClass) {
    throw new Error(`Không có settings DTO cho format: ${format}`);
  }
  return Object.assign(new DtoClass(), settings);
}
