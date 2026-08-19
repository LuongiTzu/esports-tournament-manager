import {
  IsString,
  IsOptional,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  Min,
  ValidateNested,
  MaxLength,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Gender, MemberRole } from '@prisma/client';

/**
 * Hồ sơ 1 thành viên trong đội (UC-U07)
 * Các rule phụ thuộc dữ liệu DB (tuổi, vị trí hợp lệ, số dự bị...) được
 * validate ở tầng service vì cần đọc Tournament + Game.
 */
export class TeamMemberInputDto {
  @IsString({ message: 'Tên thật phải là chuỗi' })
  @MaxLength(100, { message: 'Tên thật không được quá 100 ký tự' })
  realName!: string;

  @IsString({ message: 'Tên thi đấu (IGN) phải là chuỗi' })
  @MaxLength(30, { message: 'IGN không được quá 30 ký tự' })
  ign!: string;

  @IsOptional()
  @IsString({ message: 'ID game phải là chuỗi' })
  @MaxLength(100, { message: 'ID game không được quá 100 ký tự' })
  inGameId?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh phải đúng định dạng ISO 8601' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender?: Gender;

  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
  email?: string;

  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString({ message: 'SĐT phải là chuỗi' })
  @MaxLength(20, { message: 'SĐT không được quá 20 ký tự' })
  phoneNumber?: string;

  @IsOptional()
  @IsString({ message: 'Vị trí thi đấu phải là chuỗi' })
  @MaxLength(50, { message: 'Vị trí thi đấu không được quá 50 ký tự' })
  position?: string;

  @IsOptional()
  @IsEnum(MemberRole, { message: 'Vai trò thành viên không hợp lệ' })
  memberRole?: MemberRole;

  @IsOptional()
  @IsString({ message: 'Avatar URL phải là chuỗi' })
  @MaxLength(500, { message: 'Avatar URL không được quá 500 ký tự' })
  avatarUrl?: string;

  @IsOptional()
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  orderIndex?: number;
}

/**
 * DTO đăng ký đội tham gia giải (UC-U11)
 * - Người dùng tự đăng ký, trở thành captain
 * - Thông tin người đại diện được FE điền sẵn từ tài khoản đang đăng nhập
 */
export class RegisterTeamDto {
  @IsString({ message: 'Tên đội phải là chuỗi' })
  @MaxLength(50, { message: 'Tên đội không được quá 50 ký tự' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Tên viết tắt phải là chuỗi' })
  @MaxLength(10, { message: 'Tên viết tắt không được quá 10 ký tự' })
  shortName?: string;

  @IsOptional()
  @IsString({ message: 'Logo URL phải là chuỗi' })
  @MaxLength(500, { message: 'Logo URL không được quá 500 ký tự' })
  logoUrl?: string;

  @IsOptional()
  @IsString({ message: 'Giới thiệu đội phải là chuỗi' })
  @MaxLength(2000, { message: 'Giới thiệu đội không được quá 2000 ký tự' })
  description?: string;

  @IsString({ message: 'Tên người đại diện phải là chuỗi' })
  @Matches(/\S/, { message: 'Tên người đại diện là bắt buộc' })
  @MaxLength(100, { message: 'Tên người đại diện không được quá 100 ký tự' })
  contactName!: string;

  @IsEmail({}, { message: 'Email người đại diện không hợp lệ' })
  contactEmail!: string;

  @IsString({ message: 'SĐT người đại diện phải là chuỗi' })
  @Matches(/\S/, { message: 'Số điện thoại đại diện là bắt buộc' })
  @MaxLength(20, { message: 'SĐT người đại diện không được quá 20 ký tự' })
  contactPhone!: string;

  @IsArray({ message: 'Danh sách thành viên không hợp lệ' })
  @ValidateNested({ each: true })
  @Type(() => TeamMemberInputDto)
  @ArrayMinSize(1, { message: 'Đội phải có ít nhất 1 thành viên' })
  members!: TeamMemberInputDto[];
}

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === 'string' && !value.trim() ? undefined : value;
}
