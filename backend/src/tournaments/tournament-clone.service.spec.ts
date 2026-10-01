import { TournamentStatus, Visibility } from '@prisma/client';
import { CompetitionAuditWriter } from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentCloneService } from './tournament-clone.service';
import { TournamentCommandService } from './tournament-command.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';

describe('TournamentCloneService', () => {
  it('copies configuration and rounds into a private draft only', async () => {
    const transaction = jest.fn(
      async (
        callback: (client: PrismaService) => Promise<unknown>,
      ): Promise<unknown> => callback({} as PrismaService),
    );
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'source-1',
          gameId: 'game-1',
          minTeamSize: 5,
          maxTeamSize: 7,
          customGameName: null,
          description: 'Description',
          rules: 'Rules',
          bannerUrl: 'https://example.com/banner.png',
          mode: 'ONLINE',
          location: null,
          maxTeams: 16,
          minAge: null,
          maxAge: null,
          allowedGenders: null,
          autoApproveTeams: false,
          requireMemberFullInfo: true,
          prizePool: null,
          contactEmail: null,
          contactPhone: null,
          contactLink: null,
          rounds: [
            {
              name: 'Group stage',
              format: 'GROUP_STAGE',
              bestOf: 1,
              settings: { numberOfGroups: 4 },
            },
          ],
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    let capturedUserId: string | undefined;
    let capturedDto: CreateTournamentDto | undefined;
    const create = jest.fn(
      (
        userId: string,
        dto: CreateTournamentDto,
      ): Promise<{ id: string; name: string; slug: string }> => {
        capturedUserId = userId;
        capturedDto = dto;
        return Promise.resolve({
          id: 'clone-1',
          name: 'Season 2',
          slug: 'season-2',
        });
      },
    );
    const commands = {
      create,
    } as unknown as TournamentCommandService;
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as CompetitionAuditWriter;
    const service = new TournamentCloneService(prisma, commands, audit);

    await service.clone('source-1', 'owner-1', { name: ' Season 2 ' });

    expect(create).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({
        name: 'Season 2',
        status: TournamentStatus.DRAFT,
        visibility: Visibility.PRIVATE,
        registrationOpen: false,
        rounds: [expect.objectContaining({ name: 'Group stage', bestOf: 1 })],
      }),
      undefined,
    );
    expect(capturedUserId).toBe('owner-1');
    expect(capturedDto).not.toHaveProperty('registrationStartDate');
    expect(capturedDto).not.toHaveProperty('startDate');
    expect(capturedDto).not.toHaveProperty('teams');
  });
});
