import { BracketType, RoundFormat } from '@prisma/client';
import { BracketTeam, MatchDraft } from '../types/bracket-generator';
import { DoubleElimGenerator } from './double-elim.generator';
import { PlayoffGenerator } from './playoff.generator';

function teams(count: number): BracketTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
}

function generate(count: number, grandFinalReset = false): MatchDraft[] {
  return new DoubleElimGenerator(new PlayoffGenerator()).generate({
    format: RoundFormat.DOUBLE_ELIM,
    teams: teams(count),
    settings: { seeding: 'STANDARD', grandFinalReset },
    bestOf: 3,
  });
}

function type(matches: MatchDraft[], bracketType: BracketType): MatchDraft[] {
  return matches.filter((match) => match.bracketType === bracketType);
}

describe('DoubleElimGenerator', () => {
  it.each([
    [4, 3, 2],
    [8, 7, 6],
  ])(
    'builds complete winner and loser brackets for %i teams',
    (count, winnerCount, loserCount) => {
      const result = generate(count);

      expect(type(result, BracketType.WINNER)).toHaveLength(winnerCount);
      expect(type(result, BracketType.LOSER)).toHaveLength(loserCount);
      expect(
        result.filter((match) => match.matchKind === 'GRAND_FINAL'),
      ).toHaveLength(1);
    },
  );

  it('reuses the standard seeded winner bracket', () => {
    const firstRound = type(generate(8), BracketType.WINNER).filter(
      (match) => match.bracketRound === 1,
    );

    expect(
      firstRound.map((match) => [match.teamA.teamId, match.teamB.teamId]),
    ).toEqual([
      ['team-1', 'team-8'],
      ['team-4', 'team-5'],
      ['team-3', 'team-6'],
      ['team-2', 'team-7'],
    ]);
  });

  it('creates the alternating 8-team loser bracket structure', () => {
    const loser = type(generate(8), BracketType.LOSER);

    expect(
      [...new Set(loser.map((match) => match.bracketRound))].map((round) => [
        round,
        loser.filter((match) => match.bracketRound === round).length,
      ]),
    ).toEqual([
      [1, 2],
      [2, 2],
      [3, 1],
      [4, 1],
    ]);
    expect(loser.map((match) => match.roundName)).toEqual([
      'Nhánh thua vòng 1 (minor)',
      'Nhánh thua vòng 1 (minor)',
      'Nhánh thua vòng 2 (major)',
      'Nhánh thua vòng 2 (major)',
      'Nhánh thua vòng 3 (minor)',
      'Nhánh thua vòng 4 (major)',
    ]);
  });

  it('routes every actual winner-bracket loser deterministically', () => {
    const winner = type(generate(8), BracketType.WINNER);

    expect(
      winner.map((match) => [
        match.key,
        match.loserNextMatchKey,
        match.loserNextMatchSlot,
      ]),
    ).toEqual([
      ['winner-1-1', 'loser-1-1', 'A'],
      ['winner-1-2', 'loser-1-1', 'B'],
      ['winner-1-3', 'loser-1-2', 'A'],
      ['winner-1-4', 'loser-1-2', 'B'],
      ['winner-2-1', 'loser-2-2', 'B'],
      ['winner-2-2', 'loser-2-1', 'B'],
      ['winner-3-1', 'loser-4-1', 'B'],
    ]);
  });

  it('links loser rounds through minor and major stages', () => {
    const loser = type(generate(8), BracketType.LOSER);

    expect(
      loser
        .slice(0, -1)
        .map((match) => [match.key, match.nextMatchKey, match.nextMatchSlot]),
    ).toEqual([
      ['loser-1-1', 'loser-2-1', 'A'],
      ['loser-1-2', 'loser-2-2', 'A'],
      ['loser-2-1', 'loser-3-1', 'A'],
      ['loser-2-2', 'loser-3-1', 'B'],
      ['loser-3-1', 'loser-4-1', 'A'],
    ]);
  });

  it('connects both bracket champions to the Grand Final', () => {
    const result = generate(8);
    const grandFinal = result.find(
      (match) => match.matchKind === 'GRAND_FINAL',
    )!;

    expect(grandFinal).toMatchObject({
      key: 'grand-final',
      bracketType: null,
      teamA: {
        teamId: null,
        sourceMatchKey: 'winner-3-1',
        sourceResult: 'WINNER',
      },
      teamB: {
        teamId: null,
        sourceMatchKey: 'loser-4-1',
        sourceResult: 'WINNER',
      },
    });
    expect(result.find((match) => match.key === 'winner-3-1')).toMatchObject({
      nextMatchKey: 'grand-final',
      nextMatchSlot: 'A',
    });
    expect(result.find((match) => match.key === 'loser-4-1')).toMatchObject({
      nextMatchKey: 'grand-final',
      nextMatchSlot: 'B',
    });
  });

  it('omits reset preparation when grandFinalReset is false', () => {
    expect(
      generate(4).some((match) => match.matchKind === 'GRAND_FINAL_RESET'),
    ).toBe(false);
  });

  it('adds only a conditional reset draft when grandFinalReset is true', () => {
    const result = generate(4, true);
    const grandFinal = result.find(
      (match) => match.matchKind === 'GRAND_FINAL',
    );
    const reset = result.find(
      (match) => match.matchKind === 'GRAND_FINAL_RESET',
    );

    expect(grandFinal).toMatchObject({
      nextMatchKey: 'grand-final-reset',
      nextMatchSlot: 'A',
      loserNextMatchKey: 'grand-final-reset',
      loserNextMatchSlot: 'B',
    });
    expect(reset).toMatchObject({
      key: 'grand-final-reset',
      activationCondition: 'LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL',
      teamA: { sourceMatchKey: 'grand-final', sourceResult: 'WINNER' },
      teamB: { sourceMatchKey: 'grand-final', sourceResult: 'LOSER' },
    });
  });

  it('preserves the 6-team winner bracket byes and does not route fake losers', () => {
    const winner = type(generate(6), BracketType.WINNER);
    const byes = winner.filter(
      (match) => match.bracketRound === 1 && match.isBye,
    );

    expect(byes).toHaveLength(2);
    expect(byes.every((match) => match.loserNextMatchKey === null)).toBe(true);
    expect(type(generate(6), BracketType.LOSER)).toHaveLength(6);
  });

  it('is deterministic', () => {
    expect(generate(8, true)).toEqual(generate(8, true));
  });

  it('rejects fields too small to form a winner and loser bracket', () => {
    expect(() => generate(2)).toThrow('at least 4 teams');
  });
});
