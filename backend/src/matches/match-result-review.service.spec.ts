/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  CompetitionAuditAction,
  MatchResultDecision,
  MatchResultReviewStatus,
  MatchStatus,
  RegistrationStatus,
} from '@prisma/client';
import { CompetitionAuditWriter } from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import { MatchResultReviewService } from './match-result-review.service';

interface ReviewResponseFixture {
  id: string;
  teamId: string;
  decision: MatchResultDecision;
  note: string | null;
  evidenceUrls: string[];
  respondedAt: Date;
  respondedBy: { id: string; displayName: string };
}

interface ReviewFixture {
  matchId: string;
  status: MatchResultReviewStatus;
  openedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  resolvedBy: { id: string; displayName: string } | null;
  responses: ReviewResponseFixture[];
}

function review(overrides: Partial<ReviewFixture> = {}): ReviewFixture {
  return {
    matchId: 'match-1',
    status: MatchResultReviewStatus.PENDING_CONFIRMATION,
    openedAt: new Date('2030-06-15T12:00:00.000Z'),
    resolvedAt: null,
    resolutionNote: null,
    resolvedBy: null,
    responses: [],
    ...overrides,
  };
}

function match(resultReview: ReviewFixture | null = review()) {
  return {
    id: 'match-1',
    status: MatchStatus.COMPLETED,
    isActive: true,
    isBye: false,
    teamAId: 'team-a',
    teamBId: 'team-b',
    teamA: {
      id: 'team-a',
      captainId: 'captain-a',
      status: RegistrationStatus.APPROVED,
    },
    teamB: {
      id: 'team-b',
      captainId: 'captain-b',
      status: RegistrationStatus.APPROVED,
    },
    round: { id: 'round-1', tournamentId: 'tournament-1' },
    resultReview,
  };
}

function harness(matchValue = match()) {
  let currentReview = matchValue.resultReview ?? review();
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'match-1' }]),
    match: { findUnique: jest.fn().mockResolvedValue(matchValue) },
    matchResultResponse: {
      create: jest.fn().mockImplementation(({ data }) => {
        currentReview = {
          ...currentReview,
          responses: [
            ...currentReview.responses,
            {
              id: `response-${data.teamId}`,
              teamId: data.teamId,
              decision: data.decision,
              note: data.note ?? null,
              evidenceUrls: data.evidenceUrls,
              respondedAt: new Date(),
              respondedBy: {
                id: data.respondedById,
                displayName: 'Captain',
              },
            },
          ],
        };
        return Promise.resolve({});
      }),
    },
    matchResultReview: {
      create: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentReview)),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ data }) => {
        currentReview = { ...currentReview, ...data };
        return Promise.resolve(currentReview);
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const audit = { record: jest.fn() } as unknown as CompetitionAuditWriter;
  return {
    tx,
    audit,
    service: new MatchResultReviewService(prisma, audit),
  };
}

describe('MatchResultReviewService', () => {
  it('records the first captain confirmation and keeps the review pending', async () => {
    const { service, tx, audit } = harness();

    const result = await service.respond('match-1', 'captain-a', {
      teamId: 'team-a',
      decision: MatchResultDecision.CONFIRMED,
    });

    expect(result.status).toBe(MatchResultReviewStatus.PENDING_CONFIRMATION);
    expect(tx.matchResultResponse.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: CompetitionAuditAction.MATCH_RESULT_CONFIRMED,
        actorId: 'captain-a',
      }),
    );
  });

  it('finalizes the review when both teams confirm', async () => {
    const existing = review({
      responses: [
        {
          id: 'response-a',
          teamId: 'team-a',
          decision: MatchResultDecision.CONFIRMED,
          note: null,
          evidenceUrls: [],
          respondedAt: new Date(),
          respondedBy: { id: 'captain-a', displayName: 'Captain A' },
        },
      ],
    });
    const { service } = harness(match(existing));

    const result = await service.respond('match-1', 'captain-b', {
      teamId: 'team-b',
      decision: MatchResultDecision.CONFIRMED,
    });

    expect(result.status).toBe(MatchResultReviewStatus.CONFIRMED);
  });

  it('opens a dispute with evidence and prevents duplicate responses', async () => {
    const { service, tx, audit } = harness();
    const result = await service.respond('match-1', 'captain-a', {
      teamId: 'team-a',
      decision: MatchResultDecision.DISPUTED,
      note: 'The recorded score for game two is incorrect.',
      evidenceUrls: ['https://example.com/evidence.png'],
    });

    expect(result.status).toBe(MatchResultReviewStatus.DISPUTED);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: CompetitionAuditAction.MATCH_RESULT_DISPUTED,
      }),
    );

    const duplicate = match(result as ReviewFixture);
    jest.mocked(tx.match.findUnique).mockResolvedValue(duplicate as never);
    await expect(
      service.respond('match-1', 'captain-a', {
        teamId: 'team-a',
        decision: MatchResultDecision.CONFIRMED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a response from a non-captain', async () => {
    const { service } = harness();
    await expect(
      service.respond('match-1', 'member-a', {
        teamId: 'team-a',
        decision: MatchResultDecision.CONFIRMED,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the organizer flow to uphold a disputed result', async () => {
    const { service, tx, audit } = harness();
    jest.mocked(tx.matchResultReview.findUnique).mockResolvedValue({
      status: MatchResultReviewStatus.DISPUTED,
      match: {
        round: { id: 'round-1', tournamentId: 'tournament-1' },
      },
    } as never);

    const result = await service.resolve('match-1', 'organizer-1', {
      resolutionNote: 'Evidence reviewed; the recorded result is correct.',
    });

    expect(result.status).toBe(MatchResultReviewStatus.RESOLVED);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: CompetitionAuditAction.MATCH_DISPUTE_RESOLVED,
        actorId: 'organizer-1',
      }),
    );
  });
});
