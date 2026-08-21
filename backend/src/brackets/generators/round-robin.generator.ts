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

    const firstCycle = this.generateCycle(slots, input.bestOf);
    const roundsPerCycle = slots.length - 1;
    return Array.from(
      { length: input.settings.meetingsPerPair },
      (_, cycleIndex) =>
        firstCycle.map((match) => {
          const bracketRound = match.bracketRound + cycleIndex * roundsPerCycle;
          const reverseSides = cycleIndex % 2 === 1;
          return {
            ...match,
            key: this.matchKey(bracketRound, match.matchNumber),
            teamA: reverseSides ? match.teamB : match.teamA,
            teamB: reverseSides ? match.teamA : match.teamB,
            bracketRound,
          };
        }),
    ).flat();
  }

  private generateCycle(
    initialSlots: (string | null)[],
    bestOf: number,
  ): MatchDraft[] {
    const rotation = [...initialSlots];
    const roundCount = rotation.length - 1;
    const matches: MatchDraft[] = [];

    for (let roundOffset = 0; roundOffset < roundCount; roundOffset++) {
      const bracketRound = roundOffset + 1;
      let matchNumber = 0;

      for (let index = 0; index < rotation.length / 2; index++) {
        const left = rotation[index];
        const right = rotation[rotation.length - 1 - index];
        if (left === null || right === null) continue;
        matchNumber++;

        matches.push({
          key: this.matchKey(bracketRound, matchNumber),
          teamA: { teamId: left },
          teamB: { teamId: right },
          bracketRound,
          bracketType: null,
          matchNumber,
          isBye: false,
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
