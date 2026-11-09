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
        evidence: {
          orderBy: { orderIndex: 'asc' },
          select: { url: true },
        },
        respondedAt: true,
        respondedBy: { select: { id: true, displayName: true } },
      },
    },
  });

export type MatchResultReviewRecord = Prisma.MatchResultReviewGetPayload<{
  select: typeof matchResultReviewSelect;
}>;

export function toMatchResultReviewResponse(review: MatchResultReviewRecord) {
  return {
    ...review,
    responses: review.responses.map(({ evidence, ...response }) => ({
      ...response,
      evidenceUrls: evidence.map(({ url }) => url),
    })),
  };
}
