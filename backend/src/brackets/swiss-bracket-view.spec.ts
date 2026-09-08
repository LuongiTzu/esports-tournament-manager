import { RoundFormat } from '@prisma/client';
import { withSwissBracketView } from './swiss-bracket-view';
import { SwissGenerator } from './generators/swiss.generator';
import { BracketQueryService } from './bracket-query.service';
import { TournamentQueryService } from '../tournaments/tournament-query.service';
import { RoundSettingsService } from './round-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { StandingsService } from './standings.service';

const teams = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  seed: null,
  shortName: null,
  logoUrl: null,
}));
const settings = { numberOfRounds: 3, advancingTeamCount: 2 };
function match(
  id: string,
  iteration: number,
  a: number,
  b: number | null,
  completed = false,
) {
  return {
    id,
    bracketRound: iteration,
    matchNumber: a + 1,
    isActive: true,
    isBye: b === null,
    status: completed ? 'COMPLETED' : 'PENDING',
    slots: { A: teams[a], B: b === null ? null : teams[b] },
    score: { A: completed ? 2 : 0, B: completed ? 1 : 0 },
    winner: completed ? teams[a] : null,
  };
}
function bracket() {
  return {
    round: {
      id: 'stage',
      name: 'Swiss',
      orderIndex: 1,
      bestOf: 3,
      status: 'ONGOING',
      format: RoundFormat.SWISS,
      settings,
    },
    matches: [
      match('m1', 1, 0, 1, true),
      match('m2', 1, 2, 3, true),
      match('m3', 2, 0, 2),
      match('m4', 2, 1, 3),
    ],
    groups: [],
  };
}

describe('Swiss bracket read model', () => {
  it('groups by records BEFORE the iteration, independent of input order or current scores', () => {
    const input = bracket();
    const before = structuredClone(input);
    const view = withSwissBracketView(input).swiss!;
    expect(input).toEqual(before);
    expect(
      view.groups.map((group) => [
        group.id,
        group.entries.map((entry) => entry.matchId),
      ]),
    ).toEqual([
      ['swiss-1-0-0', ['m1', 'm2']],
      ['swiss-2-1-0', ['m3']],
      ['swiss-2-0-1', ['m4']],
    ]);
    expect(view.links).toEqual([
      { from: 'swiss-1-0-0', to: 'swiss-2-1-0', result: 'winner' },
      { from: 'swiss-1-0-0', to: 'swiss-2-0-1', result: 'loser' },
    ]);
    input.matches[2].status = 'COMPLETED';
    input.matches[2].score = { A: 2, B: 0 };
    input.matches[2].winner = teams[0];
    expect(withSwissBracketView(input).swiss).toEqual(view);
    expect(
      withSwissBracketView({ ...input, matches: [...input.matches].reverse() })
        .swiss,
    ).toEqual(view);
    expect(before.matches[2].status).toBe('PENDING');
  });

  it('uses the existing calculator, including a previous BYE, and retains mixed-record pairings', () => {
    const input = bracket();
    input.matches = [
      match('bye', 1, 0, null, true),
      match('m2', 1, 1, 2, true),
      match('mixed', 2, 0, 2),
    ];
    const view = withSwissBracketView(input).swiss!;
    const mixed = view.groups.find((group) => group.bracketRound === 2)!;
    expect(mixed.records).toEqual([
      { wins: 1, losses: 0 },
      { wins: 0, losses: 1 },
    ]);
    expect(mixed.entries[0]).toEqual({
      matchId: 'mixed',
      A: { wins: 1, losses: 0 },
      B: { wins: 0, losses: 1 },
    });
    const rows = new SwissGenerator().calculateStandings(
      teams.map((team) => ({ ...team, registeredAt: new Date(0) })),
      input.matches
        .filter((item) => item.bracketRound === 1)
        .map((item) => ({
          teamAId: item.slots.A.id,
          teamBId: item.slots.B?.id ?? null,
          bracketRound: 1,
          scoreA: item.score.A,
          scoreB: item.score.B,
          isBye: item.isBye,
          completed: true,
        })),
      settings,
    );
    const row = rows.find((item) => item.teamId === teams[0].id)!;
    expect(mixed.entries[0].A).toEqual({ wins: row.wins, losses: row.losses });
    expect(view.links).toHaveLength(2);
  });

  it('does not invent links from unfinished matches, future groups, or qualification at 3 wins', () => {
    const input = bracket();
    input.matches[0].status = 'ONGOING';
    input.matches[0].winner = null;
    input.matches[1].status = 'PENDING';
    input.matches[1].winner = null;
    const view = withSwissBracketView(input).swiss!;
    expect(view.links).toEqual([]);
    expect(view.groups.every((group) => group.bracketRound <= 2)).toBe(true);
    expect(view.groups[view.groups.length - 1]?.records).toEqual([
      { wins: 0, losses: 0 },
    ]);
    expect(withSwissBracketView({ ...input, matches: [] }).swiss).toEqual({
      groups: [],
      links: [],
    });
    expect(
      withSwissBracketView({
        ...input,
        round: { ...input.round, format: RoundFormat.PLAYOFF },
      }).swiss,
    ).toBeNull();
  });

  it('reflects a corrected result without a cached or separately persisted history', () => {
    const input = bracket();
    input.matches[0].winner = teams[1];
    input.matches[0].score = { A: 0, B: 2 };
    const view = withSwissBracketView(input).swiss!;
    expect(
      view.groups.find((group) => group.bracketRound === 2)?.records,
    ).toEqual([
      { wins: 1, losses: 0 },
      { wins: 0, losses: 1 },
    ]);
    expect(
      view.groups
        .flatMap((group) => group.entries)
        .find((entry) => entry.matchId === 'm3')?.A,
    ).toEqual({ wins: 0, losses: 1 });
  });

  it('returns the same metadata from round and tournament bracket queries', async () => {
    const input = bracket();
    const persisted = {
      ...input.round,
      participants: [],
      groups: [],
      matches: input.matches.map((item) => ({
        ...item,
        teamA: item.slots.A,
        teamB: item.slots.B,
        scoreA: item.score.A,
        scoreB: item.score.B,
        groupId: null,
        bracketType: null,
        outcome: item.winner ? 'TEAM_A' : null,
        activationCondition: null,
        bestOf: 3,
        scheduledAt: null,
        nextMatchId: null,
        nextMatchSlot: null,
        loserNextMatchId: null,
        loserNextMatchSlot: null,
      })),
    };
    const prisma = {
      round: { findUnique: jest.fn().mockResolvedValue(persisted) },
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tournament',
          name: 'Cup',
          rounds: [persisted],
        }),
      },
    } as unknown as PrismaService;
    const settingsService = new RoundSettingsService();
    const roundResponse = await new BracketQueryService(
      prisma,
      settingsService,
    ).getBracket('stage');
    const tournamentResponse = await new TournamentQueryService(
      prisma,
      settingsService,
      {} as StandingsService,
    ).getBracket('cup');
    expect(roundResponse.swiss).toEqual(withSwissBracketView(input).swiss);
    expect(tournamentResponse.rounds[0].swiss).toEqual(roundResponse.swiss);
  });
});
