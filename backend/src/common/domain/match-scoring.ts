export const MATCH_SCORING_MODES = ['SERIES_SCORE', 'POINT_SCORE'] as const;

export type MatchScoringMode = (typeof MATCH_SCORING_MODES)[number];

export const DEFAULT_MATCH_SCORING_MODE: MatchScoringMode = 'SERIES_SCORE';

export function resolveMatchScoringMode(settings: unknown): MatchScoringMode {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return DEFAULT_MATCH_SCORING_MODE;
  }
  return (settings as Record<string, unknown>).scoringMode === 'POINT_SCORE'
    ? 'POINT_SCORE'
    : DEFAULT_MATCH_SCORING_MODE;
}
