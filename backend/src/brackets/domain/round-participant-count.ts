export interface PersistedParticipantCountSnapshot {
  participants: ReadonlyArray<{ teamId: string }>;
  groups: ReadonlyArray<{
    teamAssignments: ReadonlyArray<{ teamId: string }>;
  }>;
  matches: ReadonlyArray<{
    teamAId: string | null;
    teamBId: string | null;
  }>;
}

export function countPersistedRoundParticipants(
  round: PersistedParticipantCountSnapshot,
): number {
  const teamIds = new Set(round.participants.map(({ teamId }) => teamId));
  for (const group of round.groups) {
    for (const assignment of group.teamAssignments) {
      teamIds.add(assignment.teamId);
    }
  }
  for (const match of round.matches) {
    if (match.teamAId) teamIds.add(match.teamAId);
    if (match.teamBId) teamIds.add(match.teamBId);
  }
  return teamIds.size;
}
