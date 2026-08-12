import { Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import {
  BracketTeam,
  BracketGeneratorInput,
  IBracketGenerator,
  MatchDraft,
} from '../types/bracket-generator';

@Injectable()
export class PlayoffGenerator implements IBracketGenerator<
  typeof RoundFormat.PLAYOFF
> {
  readonly format = RoundFormat.PLAYOFF;

  generate(
    input: BracketGeneratorInput<typeof RoundFormat.PLAYOFF>,
  ): MatchDraft[] {
    validateTeams(input.teams);
    const teams = sortTeams(input.teams);
    const bracketSize = nextPowerOfTwo(teams.length);
    const seedSlots = standardSeedOrder(bracketSize);
    const rounds = Math.log2(bracketSize);
    const drafts: MatchDraft[] = [];

    for (let bracketRound = 1; bracketRound <= rounds; bracketRound++) {
      const matchCount = bracketSize / 2 ** bracketRound;
      const roundName = playoffRoundName(matchCount * 2);

      for (let index = 0; index < matchCount; index++) {
        const matchNumber = index + 1;
        const key = matchKey(bracketRound, matchNumber);
        const nextKey =
          bracketRound < rounds
            ? matchKey(bracketRound + 1, Math.floor(index / 2) + 1)
            : null;
        const nextSlot =
          nextKey === null
            ? null
            : index % 2 === 0
              ? ('A' as const)
              : ('B' as const);

        let teamA: MatchDraft['teamA'];
        let teamB: MatchDraft['teamB'];
        let isBye = false;
        if (bracketRound === 1) {
          const first = teams[seedSlots[index * 2] - 1];
          const second = teams[seedSlots[index * 2 + 1] - 1];
          teamA = { teamId: first?.id ?? second?.id ?? null };
          teamB = { teamId: first && second ? second.id : null };
          isBye = Boolean(first) !== Boolean(second);
        } else {
          const sourceA = matchKey(bracketRound - 1, index * 2 + 1);
          const sourceB = matchKey(bracketRound - 1, index * 2 + 2);
          teamA = {
            teamId: null,
            sourceMatchKey: sourceA,
            sourceResult: 'WINNER',
          };
          teamB = {
            teamId: null,
            sourceMatchKey: sourceB,
            sourceResult: 'WINNER',
          };
        }

        drafts.push({
          key,
          roundName,
          matchKind: 'STANDARD',
          teamA,
          teamB,
          bracketRound,
          bracketType: null,
          matchNumber,
          isBye,
          bestOf: input.bestOf,
          nextMatchKey: nextKey,
          nextMatchSlot: nextSlot,
          loserNextMatchKey: null,
          loserNextMatchSlot: null,
        });
      }
    }

    if (input.settings.thirdPlaceMatch && bracketSize >= 4) {
      const semifinalRound = rounds - 1;
      const thirdPlaceKey = 'playoff-third-place';
      const semifinals = drafts.filter(
        (draft) =>
          draft.bracketRound === semifinalRound &&
          draft.matchKind === 'STANDARD',
      );
      semifinals.forEach((semifinal, index) => {
        semifinal.loserNextMatchKey = thirdPlaceKey;
        semifinal.loserNextMatchSlot = index === 0 ? 'A' : 'B';
      });
      drafts.push({
        key: thirdPlaceKey,
        roundName: 'Tranh hạng ba',
        matchKind: 'THIRD_PLACE',
        teamA: {
          teamId: null,
          sourceMatchKey: semifinals[0].key,
          sourceResult: 'LOSER',
        },
        teamB: {
          teamId: null,
          sourceMatchKey: semifinals[1].key,
          sourceResult: 'LOSER',
        },
        bracketRound: rounds,
        bracketType: null,
        matchNumber: 2,
        isBye: false,
        bestOf: input.bestOf,
        nextMatchKey: null,
        nextMatchSlot: null,
        loserNextMatchKey: null,
        loserNextMatchSlot: null,
      });
    }

    return drafts;
  }
}

function validateTeams(teams: readonly BracketTeam[]): void {
  if (teams.length < 2)
    throw new RangeError('PLAYOFF requires at least 2 teams');
  if (new Set(teams.map((team) => team.id)).size !== teams.length) {
    throw new Error('PLAYOFF team IDs must be unique');
  }
}

function sortTeams(teams: readonly BracketTeam[]): BracketTeam[] {
  return [...teams].sort((a, b) => {
    if (a.seed !== null && b.seed !== null) {
      return (
        a.seed - b.seed ||
        a.registeredAt.getTime() - b.registeredAt.getTime() ||
        a.id.localeCompare(b.id)
      );
    }
    if (a.seed !== null) return -1;
    if (b.seed !== null) return 1;
    return (
      a.registeredAt.getTime() - b.registeredAt.getTime() ||
      a.id.localeCompare(b.id)
    );
  });
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}

/** Standard section ordering keeps the strongest seeds apart until the latest rounds. */
function standardSeedOrder(size: number): number[] {
  const known: Record<number, number[]> = {
    2: [1, 2],
    4: [1, 4, 2, 3],
    8: [1, 8, 4, 5, 3, 6, 2, 7],
    16: [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15],
  };
  if (known[size]) return known[size];

  // Extend larger brackets while preserving complementary first-round seeds.
  const halfOrder = standardSeedOrder(size / 2);
  return halfOrder.flatMap((seed, index) =>
    index % 2 === 0 ? [seed, size + 1 - seed] : [size + 1 - seed, seed],
  );
}

function matchKey(round: number, number: number): string {
  return `playoff-${round}-${number}`;
}

function playoffRoundName(teamsRemaining: number): string {
  if (teamsRemaining === 2) return 'Chung kết';
  if (teamsRemaining === 4) return 'Bán kết';
  if (teamsRemaining === 8) return 'Tứ kết';
  if (teamsRemaining === 16) return 'Vòng loại (Round of 16)';
  return `Vòng loại ${teamsRemaining} đội`;
}
