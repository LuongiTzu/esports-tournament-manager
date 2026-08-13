import { ModerationStatus, ReportStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ModerateTournamentDto {
  @IsEnum(ModerationStatus)
  moderationStatus!: ModerationStatus;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class ReviewReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;
}

export class LockUserDto {
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class VerifyTournamentDto {
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
