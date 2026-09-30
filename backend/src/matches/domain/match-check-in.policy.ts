export const MATCH_CHECK_IN_WINDOW_MINUTES = 30;

const MATCH_CHECK_IN_WINDOW_MS = MATCH_CHECK_IN_WINDOW_MINUTES * 60 * 1000;

export function getMatchCheckInWindow(scheduledAt: Date) {
  return {
    opensAt: new Date(scheduledAt.getTime() - MATCH_CHECK_IN_WINDOW_MS),
    closesAt: scheduledAt,
  };
}

export function isMatchCheckInOpen(scheduledAt: Date, now: Date) {
  const window = getMatchCheckInWindow(scheduledAt);
  return now >= window.opensAt && now <= window.closesAt;
}
