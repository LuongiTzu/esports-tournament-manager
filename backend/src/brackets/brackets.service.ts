import { BadRequestException, Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import { DoubleElimGenerator } from './generators/double-elim.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { PlayoffGenerator } from './generators/playoff.generator';
import { RoundRobinGenerator } from './generators/round-robin.generator';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import {
  BracketTeam,
  IBracketGenerator,
  MatchDraft,
} from './types/bracket-generator';

export interface GenerateBracketDraftsInput {
  format: RoundFormat;
  teams: readonly BracketTeam[];
  settings?: Record<string, unknown> | null;
  bestOf: number;
}

/** Selects and prepares a pure strategy. Database persistence is intentionally separate. */
@Injectable()
export class BracketsService {
  private readonly generators: ReadonlyMap<RoundFormat, IBracketGenerator>;

  constructor(
    private readonly roundSettingsService: RoundSettingsService,
    roundRobinGenerator: RoundRobinGenerator,
    groupStageGenerator: GroupStageGenerator,
    swissGenerator: SwissGenerator,
    playoffGenerator: PlayoffGenerator,
    doubleElimGenerator: DoubleElimGenerator,
  ) {
    const strategies: IBracketGenerator[] = [
      roundRobinGenerator,
      groupStageGenerator,
      swissGenerator,
      playoffGenerator,
      doubleElimGenerator,
    ];
    this.generators = new Map(
      strategies.map((generator) => [generator.format, generator]),
    );
  }

  async generate(input: GenerateBracketDraftsInput): Promise<MatchDraft[]> {
    const generator = this.generators.get(input.format);
    if (!generator) {
      throw new BadRequestException(
        `Không có bracket generator cho format: ${String(input.format)}`,
      );
    }

    const settings = await this.roundSettingsService.normalizeForFormat(
      input.format,
      input.settings,
    );

    return generator.generate({
      format: input.format,
      teams: input.teams,
      settings,
      bestOf: input.bestOf,
    });
  }
}
