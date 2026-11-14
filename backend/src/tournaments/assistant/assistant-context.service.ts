import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentQueryService } from '../tournament-query.service';
import { TournamentManagementAccessService } from '../../common/services/tournament-management-access.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class AssistantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentQueryService,
    private readonly access: TournamentManagementAccessService,
  ) {}

  async forTournament(slug: string, user?: AuthenticatedUser) {
    // Check existing visibility BEFORE reading or sending related data.
    const t = await this.tournaments.findBySlug(slug, user?.id, user?.role);
    const owner = t.organizerId === user?.id;
    const override =
      user?.role === 'ADMIN'
        ? await this.access.findActiveOverrideForAdmin(t.id, user.id, user.role)
        : null;
    const canManage = Boolean(
      owner || t.viewerStaffRole === 'CO_ORGANIZER' || override,
    );
    const canReview = Boolean(
      canManage ||
      t.viewerStaffRole === 'REFEREE' ||
      t.viewerStaffRole === 'SCOREKEEPER',
    );
    const myTeams = user
      ? await this.prisma.team.findMany({
          where: {
            tournamentId: t.id,
            OR: [
              { captainId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          },
          select: { id: true, name: true, status: true },
          take: 32,
        })
      : [];
    const matches = await this.prisma.match.findMany({
      where: { round: { tournamentId: t.id }, isActive: true },
      orderBy: [{ scheduledAt: 'asc' }, { matchNumber: 'asc' }],
      take: 100,
      select: {
        id: true,
        matchNumber: true,
        scheduledAt: true,
        status: true,
        scoreA: true,
        scoreB: true,
        winnerTeamId: true,
        outcome: true,
        isBye: true,
        bestOf: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        round: { select: { name: true, format: true, settings: true } },
      },
    });
    const ownMatches = myTeams.length
      ? await this.prisma.match.findMany({
          where: {
            round: { tournamentId: t.id },
            isActive: true,
            OR: [
              { teamAId: { in: myTeams.map((x) => x.id) } },
              { teamBId: { in: myTeams.map((x) => x.id) } },
            ],
          },
          orderBy: [{ scheduledAt: 'asc' }, { matchNumber: 'asc' }],
          take: 50,
          select: {
            matchNumber: true,
            scheduledAt: true,
            status: true,
            scoreA: true,
            scoreB: true,
            winnerTeamId: true,
            outcome: true,
            isBye: true,
            bestOf: true,
            teamA: { select: { name: true } },
            teamB: { select: { name: true } },
            round: { select: { name: true, settings: true } },
          },
        })
      : [];
    const pendingTeams =
      canManage && user?.emailVerifiedAt
        ? await this.prisma.team.count({
            where: { tournamentId: t.id, status: 'PENDING' },
          })
        : undefined;
    const reviews =
      canReview && user?.emailVerifiedAt
        ? await this.prisma.matchResultReview.groupBy({
            by: ['status'],
            where: { match: { round: { tournamentId: t.id } } },
            _count: true,
          })
        : undefined;
    return {
      tournament: t,
      canManage,
      data: {
        viewerRole: owner
          ? 'ORGANIZER'
          : (t.viewerStaffRole ?? (myTeams.length ? 'PARTICIPANT' : 'VIEWER')),
        canManage: canManage && Boolean(user?.emailVerifiedAt),
        canReview: canReview && Boolean(user?.emailVerifiedAt),
        tournament: {
          name: t.name,
          game: t.displayGameName,
          status: t.status,
          mode: t.mode,
          description: t.description,
          rules: t.rules,
          location: t.location,
          maxTeams: t.maxTeams,
          teamSize: t.minTeamSize,
          maxTeamSize: t.maxTeamSize,
          minAge: t.minAge,
          maxAge: t.maxAge,
          allowedGenders: t.allowedGenders,
          autoApproveTeams: t.autoApproveTeams,
          requireMemberFullInfo: t.requireMemberFullInfo,
          registrationStartDate: t.registrationStartDate,
          registrationDeadline: t.registrationDeadline,
          startDate: t.startDate,
          endDate: t.endDate,
          registrationOpen: t.registrationOpen,
          prizePool: t.prizePool,
          management: t.management,
          approvedTeamCount: t.teams.length,
        },
        rounds: t.rounds.map((r) => ({
          id: r.id,
          name: r.name,
          format: r.format,
          bestOf: r.bestOf,
          status: r.status,
          settings: r.settings,
        })),
        myTeams,
        myMatches: ownMatches,
        matches,
        matchesLimited: matches.length === 100,
        myMatchesLimited: ownMatches.length === 50,
        pendingTeams,
        resultReviewCounts: reviews,
      },
    };
  }
}
