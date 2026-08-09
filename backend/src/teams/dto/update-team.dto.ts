import { PartialType, OmitType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RegistrationStatus } from '@prisma/client';
import { RegisterTeamDto, TeamMemberInputDto } from './register-team.dto';

/**
 * Sửa hồ sơ đội (UC-U12) — roster quản lý qua endpoint riêng
 * (`/teams/:id/members`) nên `members` bị loại khỏi DTO này.
 */
export class UpdateTeamDto extends PartialType(
  OmitType(RegisterTeamDto, ['members'] as const),
) {}

/** Sửa 1 thành viên trong roster — gửi field nào sửa field đó */
export class UpdateTeamMemberDto extends PartialType(TeamMemberInputDto) {}

/** BTC duyệt / từ chối đội (UC-U08) */
export class UpdateTeamStatusDto {
  @IsEnum(RegistrationStatus, { message: 'Trạng thái không hợp lệ' })
  status!: RegistrationStatus;

  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @MinLength(5, { message: 'Lý do từ chối phải có ít nhất 5 ký tự' })
  @MaxLength(500, { message: 'Lý do từ chối không được quá 500 ký tự' })
  rejectReason?: string;
}
