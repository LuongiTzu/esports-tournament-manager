import { Injectable } from '@nestjs/common';
import { TournamentMode, TournamentStatus } from '@prisma/client';
import {
  CreateRoundDto,
  CreateTournamentDto,
} from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentCommandService } from './tournament-command.service';
import { TournamentQueryService } from './tournament-query.service';
import { TournamentFavoriteService } from './tournament-favorite.service';
import { TournamentFinalizationService } from './tournament-finalization.service';
import { ConfirmFinalStandingsDto } from './dto/finalize-tournament.dto';
import { TournamentListSort } from './dto/tournament-list-query.dto';
import { TournamentStaffService } from './tournament-staff.service';
import { TournamentCloneService } from './tournament-clone.service';
import {
  AddTournamentStaffDto,
  CloneTournamentDto,
  UpdateTournamentStaffDto,
} from './dto/tournament-staff.dto';

@Injectable()
export class TournamentsService {
  constructor(
    private readonly commands: TournamentCommandService,
    private readonly queries: TournamentQueryService,
    private readonly favorites: TournamentFavoriteService,
    private readonly finalization: TournamentFinalizationService = {} as TournamentFinalizationService,
    private readonly staff: TournamentStaffService = {} as TournamentStaffService,
    private readonly cloning: TournamentCloneService = {} as TournamentCloneService,
  ) {}
  create(userId: string, dto: CreateTournamentDto, userRole?: string) {
    return this.commands.create(userId, dto, userRole);
  }
  clone(
    tournamentId: string,
    userId: string,
    dto: CloneTournamentDto,
    userRole?: string,
  ) {
    return this.cloning.clone(tournamentId, userId, dto, userRole);
  }
  listStaff(tournamentId: string) {
    return this.staff.list(tournamentId);
  }
  addStaff(tournamentId: string, actorId: string, dto: AddTournamentStaffDto) {
    return this.staff.add(tournamentId, actorId, dto);
  }
  updateStaff(
    tournamentId: string,
    staffId: string,
    actorId: string,
    dto: UpdateTournamentStaffDto,
  ) {
    return this.staff.update(tournamentId, staffId, actorId, dto);
  }
  removeStaff(tournamentId: string, staffId: string, actorId: string) {
    return this.staff.remove(tournamentId, staffId, actorId);
  }
  findAllPublic(
    query: {
      search?: string;
      gameId?: string;
      status?: TournamentStatus;
      mode?: TournamentMode;
      isVerified?: boolean;
      sort?: TournamentListSort;
      page?: number;
      limit?: number;
    },
    userId?: string,
  ) {
    return this.queries.findAllPublic(query, userId);
  }
  findBySlug(slug: string, userId?: string, userRole?: string) {
    return this.queries.findBySlug(slug, userId, userRole);
  }
  update(tournamentId: string, dto: UpdateTournamentDto) {
    return this.commands.update(tournamentId, dto);
  }
  confirmFinalStandings(
    tournamentId: string,
    dto: ConfirmFinalStandingsDto,
    actorId?: string,
  ) {
    return this.finalization.confirmFinalStandings(
      tournamentId,
      dto.championTeamId,
      actorId,
    );
  }
  remove(tournamentId: string) {
    return this.commands.remove(tournamentId);
  }
  findMyTournaments(
    userId: string,
    tab: 'organized' | 'joined',
    userRole?: string,
  ) {
    return this.queries.findMyTournaments(userId, tab, userRole);
  }
  findFavoriteTournaments(userId: string, userRole?: string) {
    return this.queries.findFavoriteTournaments(userId, userRole);
  }
  favorite(userId: string, slug: string) {
    return this.favorites.favorite(userId, slug);
  }
  unfavorite(userId: string, slug: string) {
    return this.favorites.unfavorite(userId, slug);
  }
  addRound(tournamentId: string, dto: CreateRoundDto) {
    return this.commands.addRound(tournamentId, dto);
  }
  addRoundBySlug(slug: string, dto: CreateRoundDto) {
    return this.commands.addRoundBySlug(slug, dto);
  }
  getStandings(slug: string, userId?: string, userRole?: string) {
    return this.queries.getStandings(slug, userId, userRole);
  }
  getSchedule(slug: string) {
    return this.queries.getSchedule(slug);
  }
  getBracket(slug: string) {
    return this.queries.getBracket(slug);
  }
}
