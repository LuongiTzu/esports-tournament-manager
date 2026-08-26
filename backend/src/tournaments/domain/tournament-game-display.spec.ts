import {
  resolveTournamentGameDisplayName,
  withTournamentGameDisplayName,
} from './tournament-game-display';

describe('tournament game display name', () => {
  it('uses the catalog name for a normal game', () => {
    expect(
      resolveTournamentGameDisplayName({
        customGameName: 'Ignored custom value',
        game: { code: 'MLBB', name: 'Mobile Legends: Bang Bang' },
      }),
    ).toBe('Mobile Legends: Bang Bang');
  });

  it('uses the trimmed tournament name for CUSTOM by stable code', () => {
    expect(
      withTournamentGameDisplayName({
        id: 'tournament-1',
        customGameName: '  Chess  ',
        game: { code: 'CUSTOM', name: 'Custom Game' },
      }),
    ).toEqual(
      expect.objectContaining({
        id: 'tournament-1',
        displayGameName: 'Chess',
      }),
    );
  });

  it('does not use the display name as CUSTOM identity', () => {
    expect(
      resolveTournamentGameDisplayName({
        customGameName: 'Chess',
        game: { code: 'LEGACY', name: 'Custom Game' },
      }),
    ).toBe('Custom Game');
  });

  it('uses a deterministic fallback for malformed legacy CUSTOM data', () => {
    expect(
      resolveTournamentGameDisplayName({
        customGameName: '   ',
        game: { code: 'CUSTOM', name: 'Custom Game' },
      }),
    ).toBe('Custom');
  });
});
