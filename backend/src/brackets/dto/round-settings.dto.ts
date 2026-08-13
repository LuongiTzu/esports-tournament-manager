import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  ArrayUnique,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { RoundFormat } from '@prisma/client';

/**
 * DTO validate `Round.settings` theo từng thể thức.
 *
 * Vì `settings` được gửi dưới dạng JSON object, ta không thể dùng một DTO tĩnh duy nhất.
 * Thay vào đó: mỗi thể thức có một DTO riêng, và `RoundSettingsDto` là wrapper chọn
 * đúng DTO dựa trên `format` (factory pattern). Điều này giữ cho validation rõ ràng,
 * tách biệt theo từng nghiệp vụ — đúng tinh thần clean architecture.
 */

/** Vòng tròn tính điểm */
export class RoundRobinSettingsDto {
  @IsBoolean({ message: 'doubleRound phải là boolean' })
  doubleRound!: boolean;

  @IsInt({ message: 'pointsWin phải là số nguyên' })
  @Min(1, { message: 'pointsWin tối thiểu là 1' })
  @Max(10, { message: 'pointsWin tối đa là 10' })
  pointsWin!: number;

  @IsInt({ message: 'pointsDraw phải là số nguyên' })
  @Min(0, { message: 'pointsDraw tối thiểu là 0' })
  @Max(10, { message: 'pointsDraw tối đa là 10' })
  pointsDraw!: number;

  @IsInt({ message: 'pointsLoss phải là số nguyên' })
  @Min(0, { message: 'pointsLoss tối thiểu là 0' })
  @Max(10, { message: 'pointsLoss tối đa là 10' })
  pointsLoss!: number;
}

/** Vòng bảng */
export class GroupStageSettingsDto {
  @IsInt({ message: 'numGroups phải là số nguyên' })
  @Min(1, { message: 'numGroups tối thiểu là 1' })
  @Max(16, { message: 'numGroups tối đa là 16' })
  numGroups!: number;

  @IsInt({ message: 'teamsPerGroup phải là số nguyên' })
  @Min(2, { message: 'teamsPerGroup tối thiểu là 2' })
  @Max(32, { message: 'teamsPerGroup tối đa là 32' })
  teamsPerGroup!: number;

  @IsInt({ message: 'advanceCount phải là số nguyên' })
  @Min(1, { message: 'advanceCount tối thiểu là 1' })
  advanceCount!: number;

  @IsBoolean({ message: 'doubleRound phải là boolean' })
  doubleRound!: boolean;
}

/** Thụy Sĩ */
export class SwissSettingsDto {
  @IsInt({ message: 'numRounds phải là số nguyên' })
  @Min(1, { message: 'numRounds tối thiểu là 1' })
  @Max(20, { message: 'numRounds tối đa là 20' })
  numRounds!: number;

  @IsInt({ message: 'pointsWin phải là số nguyên' })
  @Min(1, { message: 'pointsWin tối thiểu là 1' })
  @Max(10, { message: 'pointsWin tối đa là 10' })
  pointsWin!: number;

  @IsInt({ message: 'pointsDraw phải là số nguyên' })
  @Min(0, { message: 'pointsDraw tối thiểu là 0' })
  @Max(10, { message: 'pointsDraw tối đa là 10' })
  pointsDraw!: number;

  @IsInt({ message: 'pointsLoss phải là số nguyên' })
  @Min(0, { message: 'pointsLoss tối thiểu là 0' })
  @Max(10, { message: 'pointsLoss tối đa là 10' })
  pointsLoss!: number;

  @IsArray({ message: 'tiebreakers phải là mảng' })
  @ArrayMinSize(1, { message: 'tiebreakers phải có ít nhất 1 giá trị' })
  @ArrayUnique({ message: 'tiebreakers không được trùng giá trị' })
  @IsEnum(['BUCHHOLZ', 'HEAD_TO_HEAD', 'SCORE_DIFF'] as const, {
    each: true,
    message: 'Tiebreaker không hợp lệ (BUCHHOLZ, HEAD_TO_HEAD, SCORE_DIFF)',
  })
  tiebreakers!: ('BUCHHOLZ' | 'HEAD_TO_HEAD' | 'SCORE_DIFF')[];

  @IsInt({ message: 'advanceCount phải là số nguyên' })
  @Min(1, { message: 'advanceCount tối thiểu là 1' })
  advanceCount!: number;
}

/** Playoff — Single Elimination */
export class PlayoffSettingsDto {
  @IsEnum(['STANDARD'] as const, {
    message: 'seeding không hợp lệ (chỉ hỗ trợ STANDARD)',
  })
  seeding!: 'STANDARD';

  @IsBoolean({ message: 'thirdPlaceMatch phải là boolean' })
  thirdPlaceMatch!: boolean;
}

/** Double Elimination */
export class DoubleElimSettingsDto {
  @IsEnum(['STANDARD'] as const, {
    message: 'seeding không hợp lệ (chỉ hỗ trợ STANDARD)',
  })
  seeding!: 'STANDARD';

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
