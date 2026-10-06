import { Injectable } from '@nestjs/common';
import {
  BulkScheduleDto,
  CreateManualMatchDto,
  PutMatchScoresDto,
  UpdateMatchDto,
} from './dto/match.dto';
import { MatchQueryService } from './match-query.service';
import { MatchResultService } from './match-result.service';
import { MatchSchedulingService } from './match-scheduling.service';
import { MyMatchesQueryDto } from './dto/my-matches-query.dto';
import { MatchCheckInDto } from './dto/match-check-in.dto';
import { MatchCheckInService } from './match-check-in.service';
import {
  ResolveMatchDisputeDto,
  RespondToMatchResultDto,
} from './dto/match-result-review.dto';
import { MatchResultReviewService } from './match-result-review.service';
import { TournamentResultReviewsQueryDto } from './dto/tournament-result-reviews.dto';

@Injectable()
export class MatchesService {
  constructor(
    private readonly queries: MatchQueryService,
    private readonly scheduling: MatchSchedulingService,
    private readonly results: MatchResultService,
    private readonly checkIns: MatchCheckInService,
    private readonly resultReviews: MatchResultReviewService,
  ) {}
  findOne(matchId: string) {
    return this.queries.findOne(matchId);
  }
  findForUser(userId: string, query: MyMatchesQueryDto) {
    return this.queries.findForUser(userId, query);
  }
  findResultReview(matchId: string) {
    return this.resultReviews.findOne(matchId);
  }
  findTournamentResultReviews(
    tournamentId: string,
    query: TournamentResultReviewsQueryDto,
  ) {
    return this.resultReviews.findForTournament(tournamentId, query);
  }
  checkIn(matchId: string, userId: string, dto: MatchCheckInDto) {
    return this.checkIns.checkIn(matchId, userId, dto);
  }
  respondToResult(
    matchId: string,
    userId: string,
    dto: RespondToMatchResultDto,
  ) {
    return this.resultReviews.respond(matchId, userId, dto);
  }
  resolveResultDispute(
    matchId: string,
    actorId: string,
    dto: ResolveMatchDisputeDto,
  ) {
    return this.resultReviews.resolve(matchId, actorId, dto);
  }
  update(matchId: string, dto: UpdateMatchDto, actorId?: string) {
    return this.results.update(matchId, dto, actorId);
  }
  putScores(matchId: string, dto: PutMatchScoresDto, actorId?: string) {
    return this.results.putScores(matchId, dto, actorId);
  }
  bulkSchedule(dto: BulkScheduleDto) {
    return this.scheduling.bulkSchedule(dto);
  }
  createManual(roundId: string, dto: CreateManualMatchDto) {
    return this.scheduling.createManual(roundId, dto);
  }
}
