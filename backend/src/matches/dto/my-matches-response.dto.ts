import {
  MatchOutcome,
  MatchStatus,
  RoundFormat,
  TournamentMode,
  TournamentStatus,
} from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { MatchCheckInResponseDto } from './match-check-in.dto';
import { MatchResultReviewDto } from './match-result-review.dto';

class MyMatchCheckInWindowDto {
  @ApiProperty({ type: String, format: 'date-time' })
  opensAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  closesAt!: Date;
}

class MyMatchTeamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  shortName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  seed!: number | null;
}

class MyMatchGameDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  iconUrl!: string | null;
}

class MyMatchTournamentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ enum: TournamentStatus })
  status!: TournamentStatus;

  @ApiProperty({ enum: TournamentMode })
  mode!: TournamentMode;

  @ApiProperty({ type: String, nullable: true })
  location!: string | null;

  @ApiProperty({ type: String, nullable: true })
  customGameName!: string | null;

  @ApiProperty()
  displayGameName!: string;

  @ApiProperty({ type: MyMatchGameDto })
  game!: MyMatchGameDto;
}

class MyMatchRoundDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: RoundFormat })
  format!: RoundFormat;

  @ApiProperty({ type: MyMatchTournamentDto })
  tournament!: MyMatchTournamentDto;
}

export class MyMatchItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: MatchStatus })
  status!: MatchStatus;

  @ApiProperty({ enum: MatchOutcome, nullable: true })
  outcome!: MatchOutcome | null;

  @ApiProperty()
  scoreA!: number;

  @ApiProperty()
  scoreB!: number;

  @ApiProperty()
  bestOf!: number;

  @ApiProperty({ type: Number, nullable: true })
  bracketRound!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  matchNumber!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  scheduledAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  playedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  discordLink!: string | null;

  @ApiProperty({ type: MyMatchTeamDto, nullable: true })
  teamA!: MyMatchTeamDto | null;

  @ApiProperty({ type: MyMatchTeamDto, nullable: true })
  teamB!: MyMatchTeamDto | null;

  @ApiProperty({ type: MyMatchTeamDto, nullable: true })
  winner!: MyMatchTeamDto | null;

  @ApiProperty({ type: [String] })
  userTeamIds!: string[];

  @ApiProperty({ type: [String] })
  captainTeamIds!: string[];

  @ApiProperty({ type: [MatchCheckInResponseDto] })
  checkIns!: MatchCheckInResponseDto[];

  @ApiProperty({ type: MyMatchCheckInWindowDto, nullable: true })
  checkInWindow!: MyMatchCheckInWindowDto | null;

  @ApiProperty({ type: MatchResultReviewDto, nullable: true })
  resultReview!: MatchResultReviewDto | null;

  @ApiProperty({ type: MyMatchRoundDto })
  round!: MyMatchRoundDto;
}

class MyMatchSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  ongoing!: number;

  @ApiProperty()
  completed!: number;
}

class MyMatchPaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class MyMatchesResponseDto {
  @ApiProperty({ type: [MyMatchItemDto] })
  data!: MyMatchItemDto[];

  @ApiProperty({ type: MyMatchItemDto, nullable: true })
  nextMatch!: MyMatchItemDto | null;

  @ApiProperty({ type: MyMatchSummaryDto })
  summary!: MyMatchSummaryDto;

  @ApiProperty({ type: MyMatchPaginationDto })
  pagination!: MyMatchPaginationDto;
}
