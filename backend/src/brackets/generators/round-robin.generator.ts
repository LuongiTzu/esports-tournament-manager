import { Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import {
  BracketGeneratorInput,
  IBracketGenerator,
  MatchDraft,
} from '../types/bracket-generator';

@Injectable()
export class RoundRobinGenerator implements IBracketGenerator<
  typeof RoundFormat.ROUND_ROBIN
> {
  readonly format = RoundFormat.ROUND_ROBIN;

  generate(
    input: BracketGeneratorInput<typeof RoundFormat.ROUND_ROBIN>,
  ): MatchDraft[] {
    this.validateTeams(input.teams);

    const slots: (string | null)[] = input.teams.map((team) => team.id);
    if (slots.length % 2 === 1) slots.push(null);

    const firstHalf = this.generateHalf(slots, input.bestOf, 1);
    if (!input.settings.doubleRound) return firstHalf;

    const roundsPerHalf = slots.length - 1;
    const secondHalf = firstHalf.map((match) => {
      const bracketRound = match.bracketRound + roundsPerHalf;
      const teamA = match.isBye ? match.teamA : match.teamB;
      const teamB = match.isBye ? match.teamB : match.teamA;

      return {
        ...match,
        key: this.matchKey(bracketRound, match.matchNumber),
        teamA,
        teamB,
        bracketRound,
      };
    });

    return [...firstHalf, ...secondHalf];
  }

  private generateHalf(
    initialSlots: (string | null)[],
    bestOf: number,
    firstRound: number,
  ): MatchDraft[] {
    const rotation = [...initialSlots];
    const roundCount = rotation.length - 1;
    const matches: MatchDraft[] = [];

    for (let roundOffset = 0; roundOffset < roundCount; roundOffset++) {
      const bracketRound = firstRound + roundOffset;

      for (let index = 0; index < rotation.length / 2; index++) {
        const left = rotation[index];
        const right = rotation[rotation.length - 1 - index];
        const isBye = left === null || right === null;
        const teamAId = left ?? right;
        const teamBId = isBye ? null : right;
        const matchNumber = index + 1;

        matches.push({
          key: this.matchKey(bracketRound, matchNumber),
          teamA: { teamId: teamAId },
          teamB: { teamId: teamBId },
          bracketRound,
          bracketType: null,
          matchNumber,
          isBye,
          bestOf,
          nextMatchKey: null,
          nextMatchSlot: null,
          loserNextMatchKey: null,
          loserNextMatchSlot: null,
        });
      }

      const last = rotation.pop()!;
      rotation.splice(1, 0, last);
    }

    return matches;
  }

  private validateTeams(
    teams: BracketGeneratorInput<typeof RoundFormat.ROUND_ROBIN>['teams'],
  ): void {
    if (teams.length < 2) {
      throw new RangeError('ROUND_ROBIN requires at least 2 teams');
    }

    const ids = new Set(teams.map((team) => team.id));
    if (ids.size !== teams.length) {
      throw new Error('ROUND_ROBIN team IDs must be unique');
    }
  }

  private matchKey(bracketRound: number, matchNumber: number): string {
    return `round-robin-${bracketRound}-${matchNumber}`;
  }
}
