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

@Injectable()
export class TournamentsService {
  constructor(
    private readonly commands: TournamentCommandService,
    private readonly queries: TournamentQueryService,
    private readonly favorites: TournamentFavoriteService,
  ) {}
  create(userId: string, dto: CreateTournamentDto) {
    return this.commands.create(userId, dto);
  }
  findAllPublic(
    query: {
      search?: string;
      gameId?: string;
      status?: TournamentStatus;
      mode?: TournamentMode;
      isVerified?: boolean;
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
