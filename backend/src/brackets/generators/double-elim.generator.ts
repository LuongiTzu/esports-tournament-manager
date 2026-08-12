import { Injectable } from '@nestjs/common';
import { BracketType, RoundFormat } from '@prisma/client';
import {
  BracketGeneratorInput,
  IBracketGenerator,
  MatchDraft,
} from '../types/bracket-generator';
import { PlayoffGenerator } from './playoff.generator';

@Injectable()
export class DoubleElimGenerator implements IBracketGenerator<
  typeof RoundFormat.DOUBLE_ELIM
> {
  readonly format = RoundFormat.DOUBLE_ELIM;

  constructor(private readonly playoffGenerator: PlayoffGenerator) {}

  generate(
    input: BracketGeneratorInput<typeof RoundFormat.DOUBLE_ELIM>,
  ): MatchDraft[] {
    if (input.teams.length < 4) {
      throw new RangeError('DOUBLE_ELIM requires at least 4 teams');
    }
    const playoffDrafts = this.playoffGenerator.generate({
      format: RoundFormat.PLAYOFF,
      teams: input.teams,
      settings: { seeding: 'STANDARD', thirdPlaceMatch: false },
      bestOf: input.bestOf,
    });
    const winner = playoffDrafts.map(toWinnerDraft);
    const winnerRounds = Math.max(...winner.map((match) => match.bracketRound));
    const loser = buildLoserBracket(winner, winnerRounds, input.bestOf);
    applyLoserRouting(winner, loser, winnerRounds);

    const winnerFinal = winner.find(
      (match) => match.bracketRound === winnerRounds && match.matchNumber === 1,
    )!;
    const loserFinal = loser[loser.length - 1];
    loserFinal.nextMatchKey = 'grand-final';
    loserFinal.nextMatchSlot = 'B';
    winnerFinal.nextMatchKey = 'grand-final';
    winnerFinal.nextMatchSlot = 'A';

    const grandFinal: MatchDraft = {
      key: 'grand-final',
      roundName: 'Chung kết tổng',
      matchKind: 'GRAND_FINAL',
      teamA: {
        teamId: null,
        sourceMatchKey: winnerFinal.key,
        sourceResult: 'WINNER',
      },
      teamB: {
        teamId: null,
        sourceMatchKey: loserFinal.key,
        sourceResult: 'WINNER',
      },
      bracketRound: winnerRounds + 1,
      bracketType: null,
      matchNumber: 1,
      isBye: false,
      bestOf: input.bestOf,
      nextMatchKey: null,
      nextMatchSlot: null,
      loserNextMatchKey: null,
      loserNextMatchSlot: null,
    };

    if (!input.settings.grandFinalReset) {
      return [...winner, ...loser, grandFinal];
    }

    const reset: MatchDraft = {
      key: 'grand-final-reset',
      roundName: 'Chung kết tổng Reset',
      matchKind: 'GRAND_FINAL_RESET',
      activationCondition: 'LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL',
      teamA: {
        teamId: null,
        sourceMatchKey: grandFinal.key,
        sourceResult: 'WINNER',
      },
      teamB: {
        teamId: null,
        sourceMatchKey: grandFinal.key,
        sourceResult: 'LOSER',
      },
      bracketRound: winnerRounds + 2,
      bracketType: null,
      matchNumber: 1,
      isBye: false,
      bestOf: input.bestOf,
      nextMatchKey: null,
      nextMatchSlot: null,
      loserNextMatchKey: null,
      loserNextMatchSlot: null,
    };
    return [...winner, ...loser, grandFinal, reset];
  }
}

function toWinnerDraft(match: MatchDraft): MatchDraft {
  const rename = (key: string | null | undefined) =>
    key?.replace(/^playoff-/, 'winner-') ?? null;
  return {
    ...match,
    key: rename(match.key)!,
    roundName: `Nhánh thắng - ${match.roundName}`,
    bracketType: BracketType.WINNER,
    teamA: {
      ...match.teamA,
      sourceMatchKey: rename(match.teamA.sourceMatchKey) ?? undefined,
    },
    teamB: {
      ...match.teamB,
      sourceMatchKey: rename(match.teamB.sourceMatchKey) ?? undefined,
    },
    nextMatchKey: rename(match.nextMatchKey),
    loserNextMatchKey: null,
    loserNextMatchSlot: null,
  };
}

function buildLoserBracket(
  winner: MatchDraft[],
  winnerRounds: number,
  bestOf: number,
): MatchDraft[] {
  const loser: MatchDraft[] = [];
  const firstWinnerRound = byRound(winner, 1);
  const firstCount = firstWinnerRound.length / 2;
  for (let index = 0; index < firstCount; index++) {
    const sourceA = firstWinnerRound[index * 2];
    const sourceB = firstWinnerRound[index * 2 + 1];
    loser.push(
      loserDraft(
        1,
        index + 1,
        loserParticipant(sourceA),
        loserParticipant(sourceB),
        bestOf,
      ),
    );
  }

  let previousRound = 1;
  for (let winnerRound = 2; winnerRound < winnerRounds; winnerRound++) {
    const incoming = byRound(winner, winnerRound);
    const previous = byRound(loser, previousRound);
    const majorRound = previousRound + 1;
    for (let index = 0; index < previous.length; index++) {
      const crossedWinnerLoser = incoming[incoming.length - 1 - index];
      loser.push(
        loserDraft(
          majorRound,
          index + 1,
          winnerParticipant(previous[index]),
          loserParticipant(crossedWinnerLoser),
          bestOf,
        ),
      );
    }

    const major = byRound(loser, majorRound);
    const minorRound = majorRound + 1;
    for (let index = 0; index < major.length / 2; index++) {
      loser.push(
        loserDraft(
          minorRound,
          index + 1,
          winnerParticipant(major[index * 2]),
          winnerParticipant(major[index * 2 + 1]),
          bestOf,
        ),
      );
    }
    previousRound = minorRound;
  }

  const finalRound = 2 * (winnerRounds - 1);
  const previousFinal = byRound(loser, previousRound)[0];
  const winnerFinal = byRound(winner, winnerRounds)[0];
  if (finalRound > previousRound) {
    loser.push(
      loserDraft(
        finalRound,
        1,
        winnerParticipant(previousFinal),
        loserParticipant(winnerFinal),
        bestOf,
      ),
    );
  }

  linkLoserRounds(loser);
  return loser;
}

function loserDraft(
  round: number,
  number: number,
  teamA: MatchDraft['teamA'],
  teamB: MatchDraft['teamB'],
  bestOf: number,
): MatchDraft {
  const normalizedA = teamA.sourceMatchKey ? teamA : teamB;
  const normalizedB = teamA.sourceMatchKey ? teamB : teamA;
  return {
    key: `loser-${round}-${number}`,
    roundName: `Nhánh thua vòng ${round} (${round % 2 === 0 ? 'major' : 'minor'})`,
    matchKind: 'STANDARD',
    teamA: normalizedA,
    teamB: normalizedB,
    bracketRound: round,
    bracketType: BracketType.LOSER,
    matchNumber: number,
    isBye: !normalizedA.sourceMatchKey || !normalizedB.sourceMatchKey,
    bestOf,
    nextMatchKey: null,
    nextMatchSlot: null,
    loserNextMatchKey: null,
    loserNextMatchSlot: null,
  };
}

function loserParticipant(match: MatchDraft): MatchDraft['teamA'] {
  return match.isBye
    ? { teamId: null }
    : { teamId: null, sourceMatchKey: match.key, sourceResult: 'LOSER' };
}

function winnerParticipant(match: MatchDraft): MatchDraft['teamA'] {
  return { teamId: null, sourceMatchKey: match.key, sourceResult: 'WINNER' };
}

function byRound(matches: MatchDraft[], round: number): MatchDraft[] {
  return matches
    .filter((match) => match.bracketRound === round)
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

function linkLoserRounds(loser: MatchDraft[]): void {
  const maxRound = Math.max(...loser.map((match) => match.bracketRound));
  for (let round = 1; round < maxRound; round++) {
    const current = byRound(loser, round);
    const next = byRound(loser, round + 1);
    current.forEach((match, index) => {
      if (next.length === current.length) {
        match.nextMatchKey = next[index].key;
        match.nextMatchSlot = 'A';
      } else {
        match.nextMatchKey = next[Math.floor(index / 2)].key;
        match.nextMatchSlot = index % 2 === 0 ? 'A' : 'B';
      }
    });
  }
}

function applyLoserRouting(
  winner: MatchDraft[],
  loser: MatchDraft[],
  winnerRounds: number,
): void {
  winner.forEach((match) => {
    if (match.isBye) return;
    let destination: MatchDraft;
    let slot: 'A' | 'B';
    if (match.bracketRound === 1) {
      destination = byRound(loser, 1)[Math.floor((match.matchNumber - 1) / 2)];
      slot = match.matchNumber % 2 === 1 ? 'A' : 'B';
    } else if (match.bracketRound === winnerRounds) {
      destination = byRound(loser, 2 * (winnerRounds - 1))[0];
      slot = 'B';
    } else {
      const targets = byRound(loser, 2 * (match.bracketRound - 1));
      destination = targets[targets.length - match.matchNumber];
      slot = 'B';
    }
    match.loserNextMatchKey = destination.key;
    match.loserNextMatchSlot = slot;
  });
}
