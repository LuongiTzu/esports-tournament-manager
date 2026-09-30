import { Prisma } from '@prisma/client';

export const matchResultReviewSelect =
  Prisma.validator<Prisma.MatchResultReviewSelect>()({
    matchId: true,
    status: true,
    openedAt: true,
    resolvedAt: true,
    resolutionNote: true,
    resolvedBy: { select: { id: true, displayName: true } },
    responses: {
      orderBy: { respondedAt: 'asc' },
      select: {
        id: true,
        teamId: true,
        decision: true,
        note: true,
        evidenceUrls: true,
        respondedAt: true,
        respondedBy: { select: { id: true, displayName: true } },
      },
    },
  });
