import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { RoundSettingsService } from './round-settings.service';
import { GroupStageSettings } from './types/round-settings';

/** Atomic database boundary for GROUP_STAGE generation. */
@Injectable()
export class GroupStagePersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: RoundSettingsService,
    private readonly generator: GroupStageGenerator,
  ) {}

  async generate(roundId: string) {
    return this.prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: {
          id: true,
          format: true,
          settings: true,
          bestOf: true,
          tournamentId: true,
        },
      });
      if (!round) throw new NotFoundException('Round not found');
      if (round.format !== RoundFormat.GROUP_STAGE) {
        throw new BadRequestException('Round format must be GROUP_STAGE');
      }

      const [groupCount, matchCount, participantAssignments] =
        await Promise.all([
          tx.group.count({ where: { roundId } }),
          tx.match.count({ where: { roundId } }),
          tx.roundTeam.findMany({
            where: { roundId },
            orderBy: { createdAt: 'asc' },
            select: {
              team: {
                select: {
                  id: true,
                  name: true,
                  seed: true,
                  registeredAt: true,
                  tournamentId: true,
                  status: true,
                },
              },
            },
          }),
        ]);
      if (groupCount > 0 || matchCount > 0) {
        throw new BadRequestException(
          'Round already contains groups or matches',
        );
      }

      const teams = participantAssignments.length
        ? participantAssignments
            .map((assignment) => assignment.team)
            .filter(
              (team) =>
                team.tournamentId === round.tournamentId &&
                team.status === RegistrationStatus.APPROVED,
            )
            .map((team) => ({
              id: team.id,
              name: team.name,
              seed: team.seed,
              registeredAt: team.registeredAt,
            }))
        : await tx.team.findMany({
            where: {
              tournamentId: round.tournamentId,
              status: RegistrationStatus.APPROVED,
            },
            select: { id: true, name: true, seed: true, registeredAt: true },
          });

      const settings = (await this.settingsService.normalizeForFormat(
        RoundFormat.GROUP_STAGE,
        round.settings as Record<string, unknown> | null,
      )) as GroupStageSettings;
      const input = {
        format: RoundFormat.GROUP_STAGE,
        teams,
        settings,
        bestOf: round.bestOf,
      } as const;
      const allocations = this.generator.allocate(input);
      const drafts = this.generator.generate(input);
      const persistedGroups: Array<{
        id: string;
        name: string;
        orderIndex: number;
        teamIds: string[];
        matchCount: number;
      }> = [];

      for (const allocation of allocations) {
        const group = await tx.group.create({
          data: {
            roundId,
            name: allocation.name,
            orderIndex: allocation.orderIndex,
          },
          select: { id: true, name: true, orderIndex: true },
        });
        await tx.groupTeam.createMany({
          data: allocation.teams.map((team) => ({
            groupId: group.id,
            teamId: team.id,
          })),
        });

        const groupDrafts = drafts.filter(
          (draft) => draft.group?.key === allocation.key,
        );
        await tx.match.createMany({
          data: groupDrafts.map((draft) => ({
            roundId,
            groupId: group.id,
            teamAId: draft.teamA.teamId,
            teamBId: draft.teamB.teamId,
            bracketRound: draft.bracketRound,
            bracketType: draft.bracketType,
            matchNumber: draft.matchNumber,
            isBye: draft.isBye,
            bestOf: draft.bestOf,
          })),
        });
        persistedGroups.push({
          ...group,
          teamIds: allocation.teams.map((team) => team.id),
          matchCount: groupDrafts.length,
        });
      }

      return {
        roundId,
        groupCount: persistedGroups.length,
        matchCount: drafts.length,
        groups: persistedGroups,
      };
    });
  }
}
