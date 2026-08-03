import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Thành viên trong đội (UC-U07 - Nhập thông tin đội tham gia)
 */
export class TeamMemberDto {
  @IsString({ message: 'Tên thi đấu (IGN) phải là chuỗi' })
  @MaxLength(30, { message: 'IGN không được quá 30 ký tự' })
  ign!: string;

  @IsOptional()
  @IsString({ message: 'Thông tin liên hệ phải là chuỗi' })
  @MaxLength(100, { message: 'Thông tin liên hệ không được quá 100 ký tự' })
  contactInfo?: string;
}

/**
 * DTO đăng ký đội tham gia giải (UC-U11)
 * - Người dùng tự đăng ký, trở thành captain
 * - Gồm tên đội + tối đa 5 thành viên (teamSize của game)
 */
export class RegisterTeamDto {
  @IsString({ message: 'Tên đội phải là chuỗi' })
  @MaxLength(50, { message: 'Tên đội không được quá 50 ký tự' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Logo URL phải là chuỗi' })
  @MaxLength(500, { message: 'Logo URL không được quá 500 ký tự' })
  logoUrl?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách thành viên không hợp lệ' })
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  @ArrayMaxSize(5, { message: 'Số thành viên tối đa là 5' })
  members?: TeamMemberDto[];
}
