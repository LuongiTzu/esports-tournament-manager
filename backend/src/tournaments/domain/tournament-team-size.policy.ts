import { TeamSizeMode } from '@prisma/client';

export interface TournamentGameSizeRules {
  teamSizeMode: TeamSizeMode;
  defaultTeamSize: number;
  maxTeamSize: number;
  allowedTeamSizes: number[];
  minSelectableTeamSize: number | null;
  maxSelectableTeamSize: number | null;
}

export class TournamentTeamSizeRuleError extends Error {}

export class TournamentTeamSizePolicy {
  resolveTeamSize(
    rules: TournamentGameSizeRules,
    requestedTeamSize?: number,
  ): number {
    const teamSize = requestedTeamSize ?? rules.defaultTeamSize;

    if (
      rules.teamSizeMode === TeamSizeMode.FIXED &&
      teamSize !== rules.defaultTeamSize
    ) {
      throw new TournamentTeamSizeRuleError(
        `Kích thước đội hình thi đấu phải là ${rules.defaultTeamSize}`,
      );
    }

    if (
      rules.teamSizeMode === TeamSizeMode.PRESET &&
      !rules.allowedTeamSizes.includes(teamSize)
    ) {
      throw new TournamentTeamSizeRuleError(
        `Kích thước đội hình thi đấu phải là một trong: ${rules.allowedTeamSizes.join(', ')}`,
      );
    }

    if (rules.teamSizeMode === TeamSizeMode.FLEXIBLE) {
      const minimum = rules.minSelectableTeamSize;
      const maximum = rules.maxSelectableTeamSize;
      if (
        minimum === null ||
        maximum === null ||
        teamSize < minimum ||
        teamSize > maximum
      ) {
        throw new TournamentTeamSizeRuleError(
          `Kích thước đội hình thi đấu phải từ ${minimum ?? '?'} đến ${maximum ?? '?'}`,
        );
      }
    }

    return teamSize;
  }

  resolveMaxTeamSize(
    rules: TournamentGameSizeRules,
    teamSize: number,
    requestedMaxTeamSize?: number,
  ): number {
    const defaultMaximum =
      rules.teamSizeMode === TeamSizeMode.FIXED ? rules.maxTeamSize : teamSize;
    return this.validateMaxTeamSize(
      rules,
      teamSize,
      requestedMaxTeamSize ?? defaultMaximum,
    );
  }

  validateMaxTeamSize(
    rules: TournamentGameSizeRules,
    teamSize: number,
    maxTeamSize: number,
  ): number {
    if (maxTeamSize < teamSize) {
      throw new TournamentTeamSizeRuleError(
        `Số thành viên tối đa (${maxTeamSize}) không được nhỏ hơn đội hình thi đấu (${teamSize})`,
      );
    }
    if (maxTeamSize > rules.maxTeamSize) {
      throw new TournamentTeamSizeRuleError(
        `Số thành viên tối đa (${maxTeamSize}) vượt quá giới hạn của game (${rules.maxTeamSize})`,
      );
    }
    return maxTeamSize;
  }
}
