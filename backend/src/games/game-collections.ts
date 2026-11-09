export function gamePositionCodes(positions: ReadonlyArray<{ code: string }>) {
  return positions.map(({ code }) => code);
}

export function gameAllowedTeamSizes(
  allowedTeamSizes: ReadonlyArray<{ size: number }>,
) {
  return allowedTeamSizes.map(({ size }) => size);
}

export function withGameCollections<
  T extends {
    positions: Array<{ code: string }>;
    allowedTeamSizes: Array<{ size: number }>;
  },
>(game: T) {
  return {
    ...game,
    positions: gamePositionCodes(game.positions),
    allowedTeamSizes: gameAllowedTeamSizes(game.allowedTeamSizes),
  };
}
