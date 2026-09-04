import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApplicationErrorCode } from '../errors/application-error-code';

type CompetitionMutationClient = Pick<Prisma.TransactionClient, 'round'>;

/**
 * Guards mutable setup data once a persisted competition structure consumes
 * it. Callers must hold the Tournament lock before invoking these checks.
 */
@Injectable()
export class CompetitionMutationGuardService {
  async assertParticipantSetMutable(
    client: CompetitionMutationClient,
    tournamentId: string,
  ): Promise<void> {
    const firstRound = await client.round.findFirst({
      where: { tournamentId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        _count: { select: { matches: true, groups: true } },
      },
    });
    if (
      firstRound &&
      (firstRound._count.matches > 0 || firstRound._count.groups > 0)
    ) {
      throw new ConflictException({
        code: ApplicationErrorCode.TOURNAMENT_PARTICIPANTS_LOCKED,
        message:
          'Tournament participants cannot change after the first Round structure is generated',
      });
    }
  }

  async assertRoundSeedsMutable(
    client: CompetitionMutationClient,
    roundId: string,
  ): Promise<void> {
    const round = await client.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        _count: { select: { matches: true, groups: true } },
      },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    if (round._count.matches > 0 || round._count.groups > 0) {
      throw new ConflictException({
        code: ApplicationErrorCode.ROUND_SEEDS_LOCKED,
        message: 'Round seeds cannot change after its structure is generated',
      });
    }
  }
}
