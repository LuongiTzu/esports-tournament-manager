export interface RoundSeedAssignment {
  teamId: string;
  seed: number;
}

export function assignRoundSeeds(
  orderedTeamIds: readonly string[],
): RoundSeedAssignment[] {
  if (
    orderedTeamIds.some((teamId) => !teamId) ||
    new Set(orderedTeamIds).size !== orderedTeamIds.length
  ) {
    throw new Error('Round seed input must contain unique team IDs');
  }
  return orderedTeamIds.map((teamId, index) => ({
    teamId,
    seed: index + 1,
  }));
}

export function interleaveGroupQualificationOrder(
  groups: ReadonlyArray<{
    orderIndex: number;
    teamIds: readonly string[];
  }>,
): string[] {
  const orderedGroups = [...groups].sort(
    (left, right) => left.orderIndex - right.orderIndex,
  );
  const maximumRank = Math.max(
    0,
    ...orderedGroups.map((group) => group.teamIds.length),
  );
  return Array.from({ length: maximumRank }, (_, index) =>
    orderedGroups
      .map((group) => group.teamIds[index])
      .filter((teamId): teamId is string => typeof teamId === 'string'),
  ).flat();
}
