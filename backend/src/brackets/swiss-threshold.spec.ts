import { MatchStatus, RoundFormat } from '@prisma/client';
import { SwissGenerator } from './generators/swiss.generator';
import {
  evaluateRoundCompletion,
  RoundCompletionMatch,
} from './domain/round-completion';
import { resolveSwissProgress } from './domain/swiss-progress';
import { SwissSettings } from './types/round-settings';
import { SwissMatchSnapshot } from './types/swiss';
import { RoundSettingsService } from './round-settings.service';

const settings: SwissSettings = {
  mode: 'THRESHOLD',
  winsToAdvance: 3,
  lossesToEliminate: 3,
  numberOfRounds: null,
  advancingTeamCount: 1,
};
const generator = new SwissGenerator();
function simulate(count: number, config = settings) {
  const teams = Array.from({ length: count }, (_, index) => ({
    id: `t${index}`,
    name: `Team ${index}`,
    seed: index + 1,
    registeredAt: new Date(0),
  }));
  const history: SwissMatchSnapshot[] = [];
  const persisted: RoundCompletionMatch[] = [];
  const matchCounts: number[] = [];
  const states: string[] = [];
  const stopped = new Set<string>();
  for (let round = 1; round <= 19; round++) {
    const result = generator.generateNext({
      teams,
      matches: history,
      settings: config,
      bestOf: 3,
      bracketRound: round,
    });
    expect(result.matches.length).toBeGreaterThan(0);
    matchCounts.push(result.matches.length);
    for (const draft of result.matches) {
      for (const id of [draft.teamA.teamId, draft.teamB.teamId])
        if (id) expect(stopped.has(id)).toBe(false);
      persisted.push({
        teamAId: draft.teamA.teamId,
        teamBId: draft.teamB.teamId,
        winnerTeamId: null,
        status: MatchStatus.PENDING,
        isBye: draft.isBye,
        isActive: true,
        bracketRound: round,
        bracketType: null,
        matchNumber: draft.matchNumber,
        groupId: null,
      });
    }
    const pending = resolveSwissProgress({
      participantCount: count,
      settings: config,
      matches: persisted,
      roundStatus: 'ONGOING',
      tournamentStatus: 'ONGOING',
    });
    expect(pending.blockedReason).toBe('CURRENT_ITERATION_INCOMPLETE');
    for (const match of persisted.filter(
      (item) => item.bracketRound === round,
    )) {
      match.status = MatchStatus.COMPLETED;
      match.winnerTeamId = match.teamAId!;
      history.push({
        teamAId: match.teamAId!,
        teamBId: match.teamBId!,
        scoreA: 2,
        scoreB: 0,
        isBye: match.isBye,
        bracketRound: round,
        completed: true,
      });
    }
    const standings = generator.calculateStandings(teams, history, config);
    standings
      .filter((row) => row.state !== 'ACTIVE')
      .forEach((row) => stopped.add(row.teamId));
    const completion = evaluateRoundCompletion({
      format: RoundFormat.SWISS,
      participantCount: count,
      settings: config,
      matches: persisted,
    });
    states.push(completion.code);
    if (completion.completed)
      return { standings, persisted, matchCounts, states };
    expect(completion.code).toBe('SWISS_ITERATIONS_PENDING');
  }
  throw new Error('Threshold stage did not finish');
}

describe('threshold Swiss', () => {
  it('plays the standard 16-team 3/3 stage in 33 matches and qualifies eight teams', () => {
    const result = simulate(16);
    expect(result.matchCounts).toEqual([8, 8, 8, 6, 3]);
    expect(result.states).toEqual([
      'SWISS_ITERATIONS_PENDING',
      'SWISS_ITERATIONS_PENDING',
      'SWISS_ITERATIONS_PENDING',
      'SWISS_ITERATIONS_PENDING',
      'COMPLETED',
    ]);
    expect(
      result.standings.filter((row) => row.state === 'QUALIFIED'),
    ).toHaveLength(8);
    expect(
      result.standings.filter((row) => row.state === 'ELIMINATED'),
    ).toHaveLength(8);
    const records = result.standings.map((row) => `${row.wins}-${row.losses}`);
    expect(new Set(records)).toEqual(
      new Set(['3-0', '3-1', '3-2', '0-3', '1-3', '2-3']),
    );
    expect(result.standings.every((row) => row.played <= 5)).toBe(true);
  });

  it.each([2, 5, 7, 17])(
    'handles %i teams, floating and byes without replaying stopped teams',
    (count) => {
      const result = simulate(count);
      expect(result.standings.every((row) => row.state !== 'ACTIVE')).toBe(
        true,
      );
      expect(result.matchCounts.length).toBeLessThanOrEqual(5);
    },
  );

  it('uses custom thresholds and can finish before the maximum iteration', () => {
    const result = simulate(8, {
      ...settings,
      winsToAdvance: 1,
      lossesToEliminate: 2,
    });
    expect(result.matchCounts).toEqual([4, 2]);
    expect(
      result.standings.filter((row) => row.state === 'QUALIFIED'),
    ).toHaveLength(6);
  });

  it('rejects a structure that continues scheduling a qualified team', () => {
    const { persisted } = simulate(16);
    const stoppedTeam = persisted.find(
      (match) => match.bracketRound === 1,
    )!.teamAId!;
    const corrupt = structuredClone(persisted);
    corrupt.find((match) => match.bracketRound === 5)!.teamAId = stoppedTeam;
    expect(
      evaluateRoundCompletion({
        format: 'SWISS',
        participantCount: 16,
        settings,
        matches: corrupt,
      }).code,
    ).toBe('INVALID_STRUCTURE');
  });

  it('normalizes thresholds and preserves legacy fixed-round settings', async () => {
    const service = new RoundSettingsService();
    await expect(
      service.normalizeForFormat('SWISS', {
        mode: 'THRESHOLD',
        advancingTeamCount: 0,
        numberOfRounds: 0,
      }),
    ).resolves.toMatchObject({
      mode: 'THRESHOLD',
      numberOfRounds: null,
      winsToAdvance: 3,
    });
    expect(
      await service.normalizeForFormat('SWISS', { mode: 'THRESHOLD' }),
    ).toMatchObject({
      mode: 'THRESHOLD',
      winsToAdvance: 3,
      lossesToEliminate: 3,
      numberOfRounds: null,
    });
    expect(
      service.getEffectiveSettings('SWISS', { numberOfRounds: 5 }),
    ).not.toHaveProperty('mode');
    await expect(
      service.normalizeForFormat('SWISS', {
        mode: 'THRESHOLD',
        winsToAdvance: 0,
      }),
    ).rejects.toThrow();
    await expect(
      service.normalizeForFormat('SWISS', {
        mode: 'THRESHOLD',
        lossesToEliminate: 1.5,
      }),
    ).rejects.toThrow();
  });
});
