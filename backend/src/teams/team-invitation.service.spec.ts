/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import {
  TeamInvitationPurpose,
  TeamInvitationStatus,
  TournamentMode,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';
import { TeamInvitationService } from './team-invitation.service';
import { TeamInvitationTokenService } from './team-invitation-token.service';

function tournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tournament-1',
    slug: 'private-cup',
    name: 'Private Cup',
    description: null,
    organizerId: 'organizer-1',
    status: TournamentStatus.REGISTRATION,
    visibility: Visibility.PRIVATE,
    mode: TournamentMode.ONLINE,
    registrationOpen: true,
    registrationStartDate: null,
    registrationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    startDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
    minTeamSize: 5,
    maxTeamSize: 7,
    ...overrides,
  };
}

function harness() {
  const row = tournament();
  const teamInvitation = {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ id: 'invitation-1', ...data }),
      ),
    delete: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  };
  const prisma = {
    tournament: { findUnique: jest.fn().mockResolvedValue(row) },
    teamInvitation,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback({ teamInvitation }),
    ),
  } as unknown as PrismaService;
  const teams = {
    getInvitedRegistrationForm: jest.fn(),
    registerInvited: jest.fn(),
  } as unknown as TeamsService;
  const email = { sendActivity: jest.fn() } as unknown as EmailService;
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  } as unknown as ConfigService;
  const tokens = new TeamInvitationTokenService();
  return {
    row,
    teamInvitation,
    teams,
    email,
    service: new TeamInvitationService(prisma, teams, tokens, email, config),
  };
}

describe('TeamInvitationService', () => {
  it('normalizes the recipient, expires by the registration deadline and sends no raw token to persistence', async () => {
    const { row, teamInvitation, email, service } = harness();

    await service.inviteTeam('organizer-1', row.slug, ' Captain@Example.com ');

    expect(teamInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: row.id,
        invitedById: 'organizer-1',
        email: 'captain@example.com',
        purpose: TeamInvitationPurpose.TEAM_REGISTRATION,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: row.registrationDeadline,
      }),
    });
    expect(email.sendActivity).toHaveBeenCalledWith(
      'captain@example.com',
      expect.objectContaining({
        action: expect.objectContaining({
          url: expect.stringMatching(
            /^http:\/\/localhost:3000\/team-invitations\/[A-Za-z0-9_-]+$/,
          ),
        }),
      }),
    );
  });

  it('rejects an authenticated account whose email does not match the invitation', async () => {
    const { teamInvitation, teams, service } = harness();
    teamInvitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      purpose: TeamInvitationPurpose.TEAM_REGISTRATION,
      status: TeamInvitationStatus.PENDING,
      email: 'captain@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      tournament: {
        ...tournament(),
        organizer: {},
        game: {},
      },
      team: null,
      member: null,
    });

    await expect(
      service.getRegistrationForm('raw-token', {
        id: 'user-1',
        email: 'other@example.com',
        emailVerifiedAt: new Date(),
      } as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(teams.getInvitedRegistrationForm).not.toHaveBeenCalled();
  });
});
