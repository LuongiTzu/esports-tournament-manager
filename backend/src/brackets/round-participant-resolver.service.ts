import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { BracketTeam } from './types/bracket-generator';

type ParticipantClient = Pick<Prisma.TransactionClient, 'roundTeam' | 'team'>;

export interface ParticipantRound {
  id: string;
  tournamentId: string;
  orderIndex: number;
}

export interface ResolvedRoundParticipants {
  source: 'APPROVED_TEAMS' | 'ROUND_PARTICIPANTS';
  teams: BracketTeam[];
}

/** Resolves the canonical participant snapshot used to generate one Round. */
@Injectable()
export class RoundParticipantResolver {
  async resolveForGeneration(
    tx: ParticipantClient,
    round: ParticipantRound,
  ): Promise<ResolvedRoundParticipants> {
    if (round.orderIndex === 1) {
      const teams = await tx.team.findMany({
        where: {
          tournamentId: round.tournamentId,
          status: RegistrationStatus.APPROVED,
        },
        orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          seed: true,
          registeredAt: true,
        },
      });
      return { source: 'APPROVED_TEAMS', teams };
    }

    const assignments = await tx.roundTeam.findMany({
      where: { roundId: round.id },
      orderBy: [{ createdAt: 'asc' }, { teamId: 'asc' }],
      select: {
        seed: true,
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
    });
    if (assignments.length === 0) {
      throw new ConflictException({
        code: ApplicationErrorCode.ROUND_PARTICIPANTS_NOT_READY,
        message:
          'The previous Round must persist qualified teams before this Round can be generated',
      });
    }

    const invalidAssignment = assignments.find(
      ({ team }) =>
        team.tournamentId !== round.tournamentId ||
        team.status !== RegistrationStatus.APPROVED,
    );
    if (invalidAssignment) {
      throw new ConflictException({
        code: ApplicationErrorCode.ROUND_PARTICIPANTS_INELIGIBLE,
        message:
          'Every Round participant must be an approved team of the Tournament',
      });
    }

    return {
      source: 'ROUND_PARTICIPANTS',
      teams: assignments.map(({ team, seed }) => ({
        id: team.id,
        name: team.name,
        seed: seed ?? team.seed,
        registeredAt: team.registeredAt,
      })),
    };
  }
}
