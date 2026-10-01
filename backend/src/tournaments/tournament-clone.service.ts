import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CompetitionAuditAction,
  Gender,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import { CloneTournamentDto } from './dto/tournament-staff.dto';
import { TournamentCommandService } from './tournament-command.service';

@Injectable()
export class TournamentCloneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: TournamentCommandService,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async clone(
    tournamentId: string,
    userId: string,
    dto: CloneTournamentDto,
    userRole?: string,
  ) {
    const source = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { rounds: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Tournament not found');

    const cloned = await this.commands.create(
      userId,
      {
        name: dto.name.trim(),
        gameId: source.gameId,
        teamSize: source.minTeamSize,
        maxTeamSize: source.maxTeamSize,
        customGameName: source.customGameName ?? undefined,
        description: source.description ?? undefined,
        rules: source.rules ?? undefined,
        bannerUrl: source.bannerUrl ?? undefined,
        mode: source.mode,
        location: source.location ?? undefined,
        status: TournamentStatus.DRAFT,
        visibility: Visibility.PRIVATE,
        registrationOpen: false,
        maxTeams: source.maxTeams ?? undefined,
        minAge: source.minAge ?? undefined,
        maxAge: source.maxAge ?? undefined,
        allowedGenders: Array.isArray(source.allowedGenders)
          ? (source.allowedGenders as Gender[])
          : undefined,
        autoApproveTeams: source.autoApproveTeams,
        requireMemberFullInfo: source.requireMemberFullInfo,
        prizePool: source.prizePool ?? undefined,
        contactEmail: source.contactEmail ?? undefined,
        contactPhone: source.contactPhone ?? undefined,
        contactLink: source.contactLink ?? undefined,
        rounds: source.rounds.map((round) => ({
          name: round.name,
          format: round.format,
          bestOf: round.bestOf,
          settings:
            round.settings && typeof round.settings === 'object'
              ? (round.settings as Record<string, unknown>)
              : undefined,
        })),
      },
      userRole,
    );

    if (cloned) {
      await this.prisma.$transaction((tx) =>
        this.audit.record(tx, {
          tournamentId,
          actorId: userId,
          action: CompetitionAuditAction.TOURNAMENT_CLONED,
          details: { clonedTournamentId: cloned.id, name: cloned.name },
        }),
      );
    }
    return cloned;
  }
}
