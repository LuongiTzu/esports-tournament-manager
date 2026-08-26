import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { GamePositionMode, Gender, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { RegistrationMemberInput } from './types/registration-member-input';
import {
  RegistrationError,
  RegistrationRules,
} from './types/registration-rules';
import { RegistrationRosterPolicy } from './domain/registration-roster.policy';

export type {
  RegistrationError,
  RegistrationRules,
} from './types/registration-rules';

type RegistrationValidationClient = Pick<PrismaService, 'teamMember'>;
export interface RegistrationValidationContext {
  excludeTeamId?: string;
  client?: RegistrationValidationClient;
}

@Injectable()
export class RegistrationValidatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rosterPolicy: RegistrationRosterPolicy = new RegistrationRosterPolicy(),
  ) {}

  buildRules(tournament: {
    id: string;
    minTeamSize: number;
    maxTeamSize: number;
    minAge: number | null;
    maxAge: number | null;
    allowedGenders: unknown;
    requireMemberFullInfo: boolean;
    startDate: Date | null;
    game: { positions: unknown; positionMode: GamePositionMode };
  }): RegistrationRules {
    return {
      tournamentId: tournament.id,
      minTeamSize: tournament.minTeamSize,
      maxTeamSize: tournament.maxTeamSize,
      minAge: tournament.minAge,
      maxAge: tournament.maxAge,
      allowedGenders: toGenderList(tournament.allowedGenders),
      requireMemberFullInfo: tournament.requireMemberFullInfo,
      startDate: tournament.startDate,
      positions: toStringList(tournament.game.positions),
      positionMode: tournament.game.positionMode,
    };
  }

  async validate(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
    context: RegistrationValidationContext = {},
  ): Promise<{ captainIndex: number }> {
    const { captainIndex, errors } = this.rosterPolicy.validate(rules, members);
    await this.checkCrossTeamDuplicates(
      rules,
      members,
      errors,
      context.excludeTeamId,
      context.client ?? this.prisma,
    );
    if (errors.length) {
      throw new UnprocessableEntityException({
        code: ApplicationErrorCode.REGISTRATION_INVALID,
        message: 'Hồ sơ đăng ký chưa hợp lệ',
        errors,
      });
    }
    return { captainIndex };
  }

  private async checkCrossTeamDuplicates(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
    errors: RegistrationError[],
    excludeTeamId?: string,
    client: RegistrationValidationClient = this.prisma,
  ) {
    const igns = uniqueValues(members.map((m) => m.ign));
    const inGameIds = uniqueValues(members.map((m) => m.inGameId));

    if (!igns.length && !inGameIds.length) {
      return;
    }

    const taken = await client.teamMember.findMany({
      where: {
        team: {
          tournamentId: rules.tournamentId,
          status: {
            in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING],
          },
          ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
        },
        OR: [
          ...(igns.length
            ? [{ ign: { in: igns, mode: 'insensitive' as const } }]
            : []),
          ...(inGameIds.length
            ? [{ inGameId: { in: inGameIds, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      select: { ign: true, inGameId: true, team: { select: { name: true } } },
    });

    if (!taken.length) {
      return;
    }

    const takenIgns = new Map<string, string>();
    const takenInGameIds = new Map<string, string>();
    for (const row of taken) {
      takenIgns.set(row.ign.trim().toLowerCase(), row.team.name);
      if (row.inGameId) {
        takenInGameIds.set(row.inGameId.trim().toLowerCase(), row.team.name);
      }
    }

    members.forEach((member, index) => {
      const ignOwner = takenIgns.get(member.ign?.trim().toLowerCase() ?? '');
      if (ignOwner) {
        errors.push({
          field: 'ign',
          memberIndex: index,
          message: `IGN này đã được đăng ký ở đội "${ignOwner}" trong cùng giải`,
        });
      }

      const idOwner = member.inGameId
        ? takenInGameIds.get(member.inGameId.trim().toLowerCase())
        : undefined;
      if (idOwner) {
        errors.push({
          field: 'inGameId',
          memberIndex: index,
          message: `ID game này đã được đăng ký ở đội "${idOwner}" trong cùng giải`,
        });
      }
    });
  }
}

function uniqueValues(values: (string | undefined)[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}
function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
function toGenderList(value: unknown): Gender[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter(
    (item): item is Gender => typeof item === 'string' && item in Gender,
  );
  return list.length ? list : null;
}
