import { MatchResultDecision, MatchResultReviewStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RespondToMatchResultDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @ApiProperty({ enum: MatchResultDecision })
  @IsEnum(MatchResultDecision)
  decision!: MatchResultDecision;

  @ApiPropertyOptional({ minLength: 10, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  evidenceUrls?: string[];
}

export class ResolveMatchDisputeDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resolutionNote!: string;
}

class MatchResultReviewActorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;
}

export class MatchResultResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty({ enum: MatchResultDecision })
  decision!: MatchResultDecision;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: [String] })
  evidenceUrls!: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  respondedAt!: Date;

  @ApiProperty({ type: MatchResultReviewActorDto })
  respondedBy!: MatchResultReviewActorDto;
}

export class MatchResultReviewDto {
  @ApiProperty()
  matchId!: string;

  @ApiProperty({ enum: MatchResultReviewStatus })
  status!: MatchResultReviewStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  openedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;

  @ApiProperty({ type: MatchResultReviewActorDto, nullable: true })
  resolvedBy!: MatchResultReviewActorDto | null;

  @ApiProperty({ type: [MatchResultResponseDto] })
  responses!: MatchResultResponseDto[];
}
