import type { MyMatch } from "./types";

export type MyCheckInState =
  "CHECKED_IN" | "UNSCHEDULED" | "OPENS_LATER" | "OPEN" | "MISSED";

export function getMyCheckInState(match: MyMatch, now: number) {
  if (match.status !== "PENDING") return null;

  const captainTeamId = match.captainTeamIds.find((id) =>
    match.userTeamIds.includes(id),
  );
  const teamId = captainTeamId ?? match.userTeamIds[0];
  if (!teamId) return null;
  const canCheckIn = captainTeamId === teamId;

  if (match.checkIns.some((checkIn) => checkIn.teamId === teamId)) {
    return { state: "CHECKED_IN" as const, teamId, canCheckIn };
  }
  if (!match.checkInWindow) {
    return { state: "UNSCHEDULED" as const, teamId, canCheckIn };
  }

  const opensAt = Date.parse(match.checkInWindow.opensAt);
  const closesAt = Date.parse(match.checkInWindow.closesAt);
  const state: MyCheckInState =
    now < opensAt ? "OPENS_LATER" : now > closesAt ? "MISSED" : "OPEN";

  return { state, teamId, canCheckIn };
}

export function pickPriorityMatch(matches: MyMatch[], now: number) {
  const rank = (match: MyMatch) => {
    const state = getMyCheckInState(match, now)?.state;
    return state === "OPEN"
      ? 0
      : state === "MISSED"
        ? 1
        : state === "OPENS_LATER"
          ? 2
          : state === "CHECKED_IN"
            ? 3
            : 4;
  };

  return [...new Map(matches.map((match) => [match.id, match])).values()].sort(
    (a, b) => {
      const difference = rank(a) - rank(b);
      if (difference) return difference;
      const aTime = a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity;
      const bTime = b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity;
      return rank(a) === 1 ? bTime - aTime : aTime - bTime;
    },
  )[0];
}
