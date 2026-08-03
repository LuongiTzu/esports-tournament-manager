import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Visibility } from '@prisma/client';

/**
 * DTO cập nhật giải đấu (UC-U09) — tất cả field đều optional
 */
export class UpdateTournamentDto {
  @IsOptional()
  @IsString({ message: 'Tên giải đấu phải là chuỗi' })
  @MaxLength(150, { message: 'Tên giải đấu không được quá 150 ký tự' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'gameId không hợp lệ' })
  gameId?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(2000, { message: 'Mô tả không được quá 2000 ký tự' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Thể lệ phải là chuỗi' })
  @MaxLength(5000, { message: 'Thể lệ không được quá 5000 ký tự' })
  rules?: string;

  @IsOptional()
  @IsEnum(Visibility, {
    message: 'Chế độ hiển thị không hợp lệ (PUBLIC, PRIVATE)',
  })
  visibility?: Visibility;

  @IsOptional()
  @IsBoolean({ message: 'registrationOpen phải là boolean' })
  registrationOpen?: boolean;

  @IsOptional()
  @IsInt({ message: 'maxTeams phải là số nguyên' })
  @Min(2, { message: 'maxTeams tối thiểu là 2' })
  maxTeams?: number;

  @IsOptional()
  @IsDateString({}, { message: 'startDate không hợp lệ (định dạng ISO)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate không hợp lệ (định dạng ISO)' })
  endDate?: string;
}
