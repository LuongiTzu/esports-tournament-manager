import { Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import {
  BracketTeam,
  BracketGeneratorInput,
  IBracketGenerator,
  MatchDraft,
} from '../types/bracket-generator';
import { RoundRobinGenerator } from './round-robin.generator';

export interface GroupAllocation {
  key: string;
  name: string;
  orderIndex: number;
  teams: BracketTeam[];
}

@Injectable()
export class GroupStageGenerator implements IBracketGenerator<
  typeof RoundFormat.GROUP_STAGE
> {
  readonly format = RoundFormat.GROUP_STAGE;

  constructor(private readonly roundRobinGenerator: RoundRobinGenerator) {}

  generate(
    input: BracketGeneratorInput<typeof RoundFormat.GROUP_STAGE>,
  ): MatchDraft[] {
    return this.allocate(input).flatMap((group) =>
      this.roundRobinGenerator
        .generate({
          format: RoundFormat.ROUND_ROBIN,
          teams: group.teams,
          settings: {
            doubleRound: input.settings.doubleRound,
            pointsWin: 3,
            pointsDraw: 1,
            pointsLoss: 0,
          },
          bestOf: input.bestOf,
        })
        .map((match) => ({
          ...match,
          key: `${group.key}-${match.key}`,
          group: {
            key: group.key,
            name: group.name,
            orderIndex: group.orderIndex,
          },
        })),
    );
  }

  allocate(
    input: BracketGeneratorInput<typeof RoundFormat.GROUP_STAGE>,
  ): GroupAllocation[] {
    const { numGroups, teamsPerGroup, advanceCount } = input.settings;
    if (advanceCount > teamsPerGroup) {
      throw new RangeError('advanceCount cannot exceed teamsPerGroup');
    }

    const requiredTeams = numGroups * teamsPerGroup;
    if (input.teams.length !== requiredTeams) {
      throw new RangeError(
        `GROUP_STAGE requires exactly ${requiredTeams} approved teams`,
      );
    }

    const ids = new Set(input.teams.map((team) => team.id));
    if (ids.size !== input.teams.length) {
      throw new Error('GROUP_STAGE team IDs must be unique');
    }

    const sorted = [...input.teams].sort(compareTeams);
    const groups: GroupAllocation[] = Array.from(
      { length: numGroups },
      (_, index) => ({
        key: `group-${index + 1}`,
        name: `Group ${String.fromCharCode(65 + index)}`,
        orderIndex: index + 1,
        teams: [],
      }),
    );

    sorted.forEach((team, index) => {
      const position = index % (numGroups * 2);
      const groupIndex =
        position < numGroups ? position : numGroups * 2 - 1 - position;
      groups[groupIndex].teams.push(team);
    });

    return groups;
  }
}

function compareTeams(a: BracketTeam, b: BracketTeam): number {
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
}
