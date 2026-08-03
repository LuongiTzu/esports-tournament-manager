import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Visibility, RoundFormat } from '@prisma/client';

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

  @IsOptional()
  settings?: Record<string, unknown>;
}

/** DTO tạo giải đấu (UC-U04) */
export class CreateTournamentDto {
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

  @IsOptional()
  @IsArray({ message: 'rounds phải là mảng' })
  @ArrayMinSize(1, { message: 'Giải đấu cần ít nhất 1 vòng đấu' })
  @ValidateNested({ each: true })
  @Type(() => CreateRoundDto)
  rounds?: CreateRoundDto[];
}
