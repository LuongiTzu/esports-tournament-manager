import { MatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateMatchDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  scoreA?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  scoreB?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  discordLink?: string | null;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}

export class MatchScoreDto {
  @IsInt()
  @Min(1)
  setNumber!: number;

  @IsInt()
  @Min(0)
  teamAScore!: number;

  @IsInt()
  @Min(0)
  teamBScore!: number;
}

export class PutMatchScoresDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MatchScoreDto)
  scores!: MatchScoreDto[];
}

export class BulkScheduleItemDto {
  @IsString()
  matchId!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt!: string | null;
}

export class BulkScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkScheduleItemDto)
  matches!: BulkScheduleItemDto[];
}

export class CreateManualMatchDto {
  @IsOptional()
  @IsString()
  teamAId?: string;

  @IsOptional()
  @IsString()
  teamBId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bestOf?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  discordLink?: string;
}
