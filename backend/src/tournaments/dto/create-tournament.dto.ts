import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsDateString,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
  IsEmail,
  Matches,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Visibility,
  RoundFormat,
  TournamentStatus,
  TournamentMode,
  Gender,
} from '@prisma/client';
import {
  IsLteField,
  IsBeforeField,
} from '../../common/validators/field-comparison.validator';

/** DTO cho 1 Round khi tạo giải (UC-U05) */
export class CreateRoundDto {
  @IsString({ message: 'Tên vòng đấu phải là chuỗi' })
  @MaxLength(100, { message: 'Tên vòng đấu không được quá 100 ký tự' })
  name!: string;

  @IsEnum(RoundFormat, {
    message:
      'Thể thức không hợp lệ (ROUND_ROBIN, GROUP_STAGE, SWISS, PLAYOFF, DOUBLE_ELIM)',
  })
  format!: RoundFormat;

  /** Số trận tối đa (BO1/BO3/BO5) — mặc định 1 */
  @IsOptional()
  @IsInt({ message: 'bestOf phải là số nguyên' })
  @Min(1, { message: 'bestOf tối thiểu là 1' })
  @Max(9, { message: 'bestOf tối đa là 9' })
  bestOf?: number;

  /**
   * Cấu hình chi tiết theo thể thức.
   * Được validate nghiệp vụ ở service (see RoundSettingsValidator) vì schema
   * phụ thuộc `format` — không thể dùng decorator tĩnh.
   */
  @IsOptional()
  settings?: Record<string, unknown>;
}

/** DTO tạo giải đấu (UC-U04, UC-U05) */
export class CreateTournamentDto {
  // ─── Thông tin cơ bản ────────────────────────────────────────
  @IsString({ message: 'Tên giải đấu phải là chuỗi' })
  @MaxLength(150, { message: 'Tên giải đấu không được quá 150 ký tự' })
  name!: string;

  @IsString({ message: 'gameId không hợp lệ' })
  gameId!: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(2000, { message: 'Mô tả không được quá 2000 ký tự' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Thể lệ phải là chuỗi' })
  @MaxLength(5000, { message: 'Thể lệ không được quá 5000 ký tự' })
  rules?: string;

  @IsOptional()
  @IsUrl({}, { message: 'bannerUrl không hợp lệ' })
  @MaxLength(500, { message: 'bannerUrl không được quá 500 ký tự' })
  bannerUrl?: string;

  // ─── Hình thức tổ chức ───────────────────────────────────────
  @IsOptional()
  @IsEnum(TournamentMode, {
    message: 'Hình thức tổ chức không hợp lệ (ONLINE, OFFLINE, HYBRID)',
  })
  mode?: TournamentMode;

  @IsOptional()
  @IsString({ message: 'Địa điểm phải là chuỗi' })
  @MaxLength(255, { message: 'Địa điểm không được quá 255 ký tự' })
  location?: string;

  @IsOptional()
  @IsEnum(TournamentStatus, {
    message:
      'Trạng thái không hợp lệ (DRAFT, REGISTRATION, ONGOING, COMPLETED, CANCELLED)',
  })
  status?: TournamentStatus;

  @IsOptional()
  @IsEnum(Visibility, {
    message: 'Chế độ hiển thị không hợp lệ (PUBLIC, PRIVATE)',
  })
  visibility?: Visibility;

  // ─── Giới hạn quy mô ─────────────────────────────────────────
  @IsOptional()
  @IsBoolean({ message: 'registrationOpen phải là boolean' })
  registrationOpen?: boolean;

  @IsOptional()
  @IsInt({ message: 'maxTeams phải là số nguyên' })
  @Min(2, { message: 'maxTeams tối thiểu là 2' })
  @Max(256, { message: 'maxTeams tối đa là 256' })
  maxTeams?: number;

  @IsOptional()
  @IsInt({ message: 'minTeamSize phải là số nguyên' })
  @Min(1, { message: 'minTeamSize tối thiểu là 1' })
  @IsLteField('maxTeamSize', {
    message: 'Số thành viên tối thiểu phải nhỏ hơn hoặc bằng số tối đa',
  })
  minTeamSize?: number;

  @IsOptional()
  @IsInt({ message: 'maxTeamSize phải là số nguyên' })
  @Min(1, { message: 'maxTeamSize tối thiểu là 1' })
  @Max(50, { message: 'maxTeamSize tối đa là 50' })
  maxTeamSize?: number;

  @IsOptional()
  @IsInt({ message: 'maxSubstitutes phải là số nguyên' })
  @Min(0, { message: 'maxSubstitutes không được âm' })
  @Max(20, { message: 'maxSubstitutes tối đa là 20' })
  maxSubstitutes?: number;

  // ─── Giới hạn thành viên ─────────────────────────────────────
  @IsOptional()
  @IsInt({ message: 'minAge phải là số nguyên' })
  @Min(5, { message: 'minAge tối thiểu là 5' })
  @Max(100, { message: 'minAge tối đa là 100' })
  @IsLteField('maxAge', {
    message: 'Tuổi tối thiểu phải nhỏ hơn hoặc bằng tuổi tối đa',
  })
  minAge?: number;

  @IsOptional()
  @IsInt({ message: 'maxAge phải là số nguyên' })
  @Min(5, { message: 'maxAge tối thiểu là 5' })
  @Max(100, { message: 'maxAge tối đa là 100' })
  maxAge?: number;

  @IsOptional()
  @IsArray({ message: 'allowedGenders phải là mảng' })
  @ArrayUnique({ message: 'allowedGenders không được trùng giá trị' })
  @IsEnum(Gender, {
    each: true,
    message: 'Giới tính không hợp lệ (MALE, FEMALE, OTHER)',
  })
  allowedGenders?: Gender[];

  // ─── Mốc thời gian ───────────────────────────────────────────
  @IsOptional()
  @IsDateString({}, { message: 'registrationStartDate không hợp lệ (ISO)' })
  @IsBeforeField('registrationDeadline', {
    message: 'Thời điểm mở đăng ký phải trước hạn chót đăng ký',
  })
  registrationStartDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'registrationDeadline không hợp lệ (ISO)' })
  @IsBeforeField('startDate', {
    message: 'Hạn chót đăng ký phải trước ngày bắt đầu giải',
  })
  registrationDeadline?: string;

  @IsOptional()
  @IsDateString({}, { message: 'startDate không hợp lệ (định dạng ISO)' })
  @IsBeforeField('endDate', {
    message: 'Ngày bắt đầu phải trước ngày kết thúc',
  })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate không hợp lệ (định dạng ISO)' })
  endDate?: string;

  // ─── Quy trình duyệt đội ─────────────────────────────────────
  @IsOptional()
  @IsBoolean({ message: 'autoApproveTeams phải là boolean' })
  autoApproveTeams?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'requireMemberFullInfo phải là boolean' })
  requireMemberFullInfo?: boolean;

  // ─── Giải thưởng & liên hệ BTC ───────────────────────────────
  @IsOptional()
  @IsString({ message: 'prizePool phải là chuỗi' })
  @MaxLength(1000, { message: 'prizePool không được quá 1000 ký tự' })
  prizePool?: string;

  @IsOptional()
  @IsEmail({}, { message: 'contactEmail không hợp lệ' })
  contactEmail?: string;

  @IsOptional()
  @Matches(/^(0|\+84)[0-9]{9}$/, {
    message: 'contactPhone không hợp lệ (VD: 0901234567 hoặc +84901234567)',
  })
  contactPhone?: string;

  @IsOptional()
  @IsUrl({}, { message: 'contactLink không hợp lệ' })
  @MaxLength(500, { message: 'contactLink không được quá 500 ký tự' })
  contactLink?: string;

  // ─── Cấu hình vòng đấu ───────────────────────────────────────
  @IsOptional()
  @IsArray({ message: 'rounds phải là mảng' })
  @ArrayMinSize(1, { message: 'Giải đấu cần ít nhất 1 vòng đấu' })
  @ValidateNested({ each: true })
  @Type(() => CreateRoundDto)
  rounds?: CreateRoundDto[];
}
