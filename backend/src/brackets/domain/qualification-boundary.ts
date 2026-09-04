export interface RankedQualificationCandidate {
  teamId: string;
  metrics: readonly number[];
}

export interface QualificationBoundaryTie {
  guaranteedTeamIds: string[];
  candidateTeamIds: string[];
  requiredSelections: number;
}

export interface QualificationBoundaryAnalysis {
  automaticTeamIds: string[];
  tie: QualificationBoundaryTie | null;
}

/**
 * Detects a tie band that crosses the final qualification slot. Metrics must
 * contain only competitive tie-break values, excluding deterministic fallbacks
 * such as seed or registration order.
 */
export function analyzeQualificationBoundary(
  rows: readonly RankedQualificationCandidate[],
  advanceCount: number,
): QualificationBoundaryAnalysis {
  if (!Number.isInteger(advanceCount) || advanceCount < 1) {
    throw new RangeError('advanceCount must be a positive integer');
  }
  if (advanceCount > rows.length) {
    throw new RangeError('advanceCount cannot exceed the standings size');
  }
  if (new Set(rows.map((row) => row.teamId)).size !== rows.length) {
    throw new Error('Qualification standings contain duplicate teams');
  }

  const automaticTeamIds = rows.slice(0, advanceCount).map((row) => row.teamId);
  const boundaryIndex = advanceCount - 1;
  const boundaryMetrics = rows[boundaryIndex].metrics;
  let start = boundaryIndex;
  let end = boundaryIndex;
  while (start > 0 && equalMetrics(rows[start - 1].metrics, boundaryMetrics)) {
    start -= 1;
  }
  while (
    end + 1 < rows.length &&
    equalMetrics(rows[end + 1].metrics, boundaryMetrics)
  ) {
    end += 1;
  }

  if (end < advanceCount) return { automaticTeamIds, tie: null };

  return {
    automaticTeamIds,
    tie: {
      guaranteedTeamIds: rows.slice(0, start).map((row) => row.teamId),
      candidateTeamIds: rows.slice(start, end + 1).map((row) => row.teamId),
      requiredSelections: advanceCount - start,
    },
  };
}

function equalMetrics(left: readonly number[], right: readonly number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
}
