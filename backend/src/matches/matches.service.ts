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

@Injectable()
export class MatchesService {
  constructor(
    private readonly queries: MatchQueryService,
    private readonly scheduling: MatchSchedulingService,
    private readonly results: MatchResultService,
  ) {}
  findOne(matchId: string) {
    return this.queries.findOne(matchId);
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
