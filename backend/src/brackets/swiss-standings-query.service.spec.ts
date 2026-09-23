/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchStatus, RegistrationStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoundSettingsService } from './round-settings.service';
import { SwissStandingsQueryService } from './swiss-standings-query.service';
import { SwissGenerator } from './generators/swiss.generator';

const registeredAt = new Date('2026-01-01T00:00:00.000Z');
const round = {
  format: RoundFormat.SWISS,
  settings: { roundCount: 3 },
  tournamentId: 'tournament-1',
  matches: [
    {
      teamAId: 'team-1',
      teamBId: 'team-2',
      scoreA: 1,
      scoreB: 0,
      bracketRound: 1,
      isBye: false,
      status: MatchStatus.COMPLETED,
    },
    {
      teamAId: 'team-1',
      teamBId: null,
      scoreA: 0,
      scoreB: 0,
      bracketRound: 2,
      isBye: true,
      status: MatchStatus.PENDING,
    },
    {
      teamAId: null,
      teamBId: 'team-2',
      scoreA: 0,
      scoreB: 0,
      bracketRound: 3,
      isBye: false,
      status: MatchStatus.PENDING,
    },
  ],
};

function team(
  id: string,
  tournamentId = 'tournament-1',
  status: RegistrationStatus = RegistrationStatus.APPROVED,
) {
  return { id, name: id, seed: 7, registeredAt, tournamentId, status };
}

function harness() {
  const prisma = {
    round: { findUnique: jest.fn().mockResolvedValue(round) },
    roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
    team: { findMany: jest.fn().mockResolvedValue([team('team-1')]) },
  } as unknown as PrismaService;
  const settingsService = {
    normalizeForFormat: jest.fn().mockResolvedValue({ roundCount: 3 }),
  } as unknown as RoundSettingsService;
  const generator = {
    calculateStandings: jest
      .fn()
      .mockReturnValue([{ teamId: 'team-1', points: 3 }]),
  } as unknown as SwissGenerator;
  return {
    service: new SwissStandingsQueryService(prisma, settingsService, generator),
    prisma,
    settingsService,
    generator,
  };
}

describe('SwissStandingsQueryService', () => {
  it('rejects a missing or non-Swiss round before querying participants', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.round.findUnique).mockResolvedValueOnce(null);
    await expect(service.calculate('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    jest.mocked(prisma.round.findUnique).mockResolvedValueOnce({
      ...round,
      format: RoundFormat.PLAYOFF,
    } as never);
    await expect(service.calculate('playoff')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.roundTeam.findMany).not.toHaveBeenCalled();
  });

  it('uses only approved assignments from the round tournament and respects local seeds', async () => {
    const { service, prisma, generator } = harness();
    jest.mocked(prisma.roundTeam.findMany).mockResolvedValue([
      { seed: 2, team: team('team-1') },
      { seed: 3, team: team('foreign', 'another-tournament') },
      {
        seed: 4,
        team: team('pending', 'tournament-1', RegistrationStatus.PENDING),
      },
    ] as never);

    await service.calculate('round-1');

    expect(prisma.team.findMany).not.toHaveBeenCalled();
    expect(generator.calculateStandings).toHaveBeenCalledWith(
      [{ id: 'team-1', name: 'team-1', seed: 2, registeredAt }],
      expect.any(Array),
      { roundCount: 3 },
    );
  });

  it('falls back to approved tournament teams and passes only real Swiss fixtures to the generator', async () => {
    const { service, prisma, generator, settingsService } = harness();

    await expect(service.calculate('round-1')).resolves.toEqual([
      { teamId: 'team-1', points: 3 },
    ]);

    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: 'tournament-1',
          status: RegistrationStatus.APPROVED,
        },
      }),
    );
    expect(settingsService.normalizeForFormat).toHaveBeenCalledWith(
      RoundFormat.SWISS,
      round.settings,
    );
    expect(generator.calculateStandings).toHaveBeenCalledWith(
      [team('team-1')],
      [
        {
          teamAId: 'team-1',
          teamBId: 'team-2',
          scoreA: 1,
          scoreB: 0,
          bracketRound: 1,
          isBye: false,
          completed: true,
        },
        {
          teamAId: 'team-1',
          teamBId: null,
          scoreA: 0,
          scoreB: 0,
          bracketRound: 2,
          isBye: true,
          completed: false,
        },
      ],
      { roundCount: 3 },
    );
  });
});
