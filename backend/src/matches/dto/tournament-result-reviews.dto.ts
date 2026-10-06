import { MatchResultReviewStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class TournamentResultReviewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MatchResultReviewStatus)
  status?: MatchResultReviewStatus;
}

class TournamentResultReviewTeamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

class TournamentResultReviewItemDto {
  @ApiProperty()
  matchId!: string;

  @ApiProperty()
  roundId!: string;

  @ApiProperty()
  roundName!: string;

  @ApiProperty({ nullable: true })
  matchNumber!: number | null;

  @ApiProperty({ type: TournamentResultReviewTeamDto, nullable: true })
  teamA!: TournamentResultReviewTeamDto | null;

  @ApiProperty({ type: TournamentResultReviewTeamDto, nullable: true })
  teamB!: TournamentResultReviewTeamDto | null;

  @ApiProperty({ enum: MatchResultReviewStatus })
  status!: MatchResultReviewStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  openedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

class TournamentResultReviewSummaryDto {
  @ApiProperty()
  disputed!: number;

  @ApiProperty()
  pendingConfirmation!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty()
  confirmed!: number;
}

class TournamentResultReviewPaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class TournamentResultReviewsResponseDto {
  @ApiProperty({ type: [TournamentResultReviewItemDto] })
  data!: TournamentResultReviewItemDto[];

  @ApiProperty({ type: TournamentResultReviewSummaryDto })
  summary!: TournamentResultReviewSummaryDto;

  @ApiProperty({ type: TournamentResultReviewPaginationDto })
  pagination!: TournamentResultReviewPaginationDto;
}
