import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { RoundSettingsService } from '../../brackets/round-settings.service';
import {
  CreateRoundDto,
  CreateTournamentDto,
} from '../dto/create-tournament.dto';
import { UpdateTournamentDto } from '../dto/update-tournament.dto';
import { TournamentFormatPolicy } from '../domain/tournament-format.policy';
import { TournamentTeamSizePolicy } from '../domain/tournament-team-size.policy';
import { AssistantContextService } from './assistant-context.service';
import { tournamentPayloadProperties } from './assistant.schema';
import { GAME_CATALOG_CODES } from '../../games/game-catalog';

export type AssistantContext = Awaited<
  ReturnType<AssistantContextService['forTournament']>
>;
export interface AssistantProposal {
  kind: 'create' | 'update' | 'add_round' | 'update_round';
  targetId?: string;
  slug?: string;
  targetName: string;
  gameName?: string;
  payload: Record<string, unknown>;
  before?: Record<string, unknown>;
}

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...validationMessages(error.children ?? []),
  ]);
}

async function validateProposalDto(dto: object) {
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
  });
  if (errors.length)
    throw new BadRequestException(
      validationMessages(errors).slice(0, 4).join('; '),
    );
}

@Injectable()
export class AssistantProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: RoundSettingsService,
  ) {}

  async prepare(
    plan: Record<string, unknown>,
    user?: AuthenticatedUser,
    context?: AssistantContext,
  ): Promise<AssistantProposal> {
    if (!user)
      throw new UnauthorizedException(
        'Đăng nhập để tạo hoặc sửa giải cùng Arena.',
      );
    if (!user.emailVerifiedAt)
      throw new ForbiddenException(
        'Xác minh email trước khi tạo hoặc sửa giải.',
      );
    if (plan.action !== 'create' && !context?.canManage)
      throw new ForbiddenException('Bạn không có quyền sửa giải này.');
    const t = context?.tournament;
    if (plan.action === 'update_round') {
      const round = t?.rounds.find((r) => r.id === plan.roundId);
      if (!round || !record(plan.settings))
        throw new BadRequestException('Chưa xác định được vòng đấu cần sửa.');
      const settings = await this.settings.normalizeForFormat(
        round.format,
        { ...round.settings, ...plan.settings },
        round.bestOf,
      );
      return {
        kind: 'update_round',
        targetId: round.id,
        slug: t!.slug,
        targetName: round.name,
        payload: { settings },
        before: { settings: round.settings },
      };
    }
    if (plan.action === 'add_round') {
      const round = await this.round(plan.round);
      const violation = new TournamentFormatPolicy().validateSequence([
        ...t!.rounds.map((r) => r.format),
        round.format,
      ]);
      if (violation) throw new BadRequestException(violation.message);
      return {
        kind: 'add_round',
        slug: t!.slug,
        targetName: t!.name,
        payload: { ...round },
      };
    }
    if (!record(plan.payload) || !Object.keys(plan.payload).length)
      throw new BadRequestException('Cần thêm thông tin để lập bản xem trước.');
    for (const key of Object.keys(plan.payload)) {
      if (
        !Object.prototype.hasOwnProperty.call(tournamentPayloadProperties, key)
      )
        throw new BadRequestException('Trường cập nhật không được hỗ trợ.');
    }
    if (plan.action === 'update') {
      const dto = plainToInstance(UpdateTournamentDto, plan.payload);
      await validateProposalDto(dto);
      const game = dto.gameId
        ? await this.prisma.game.findFirst({
            where: { id: dto.gameId, code: { in: GAME_CATALOG_CODES } },
            select: { name: true },
          })
        : null;
      if (dto.gameId && !game)
        throw new BadRequestException('Game không tồn tại.');
      return {
        kind: 'update',
        gameName: game?.name,
        targetId: t!.id,
        slug: t!.slug,
        targetName: t!.name,
        payload: { ...dto },
        before: Object.fromEntries(
          Object.keys(plan.payload).map((key) => [
            key,
            key === 'gameId'
              ? t!.displayGameName
              : key === 'teamSize'
                ? t!.minTeamSize
                : (t as unknown as Record<string, unknown>)[key],
          ]),
        ),
      };
    }
    if (plan.action !== 'create')
      throw new BadRequestException('Thao tác không được hỗ trợ.');
    // Draft creation never publishes a tournament or opens registrations implicitly.
    const dto = plainToInstance(CreateTournamentDto, {
      ...plan.payload,
      status: 'DRAFT',
      visibility: 'PRIVATE',
      registrationOpen: false,
    });
    await validateProposalDto(dto);
    if (!dto.name.trim())
      throw new BadRequestException(
        'Bản nháp cần tên giải, game và cấu hình hợp lệ.',
      );
    const game = await this.prisma.game.findFirst({
      where: { id: dto.gameId, code: { in: GAME_CATALOG_CODES } },
      include: { allowedTeamSizes: true },
    });
    if (!game) throw new BadRequestException('Game không tồn tại.');
    const policy = new TournamentTeamSizePolicy();
    const rules = {
      ...game,
      allowedTeamSizes: game.allowedTeamSizes.map((x) => x.size),
    };
    try {
      dto.teamSize = policy.resolveTeamSize(rules, dto.teamSize);
      dto.maxTeamSize = policy.resolveMaxTeamSize(
        rules,
        dto.teamSize,
        dto.maxTeamSize,
      );
    } catch {
      throw new BadRequestException(
        'Số người mỗi đội chưa phù hợp với game đã chọn.',
      );
    }
    if (game.code === 'CUSTOM' && !dto.customGameName?.trim())
      throw new BadRequestException('Cần tên game tùy chỉnh.');
    if (dto.mode && dto.mode !== 'ONLINE' && !dto.location?.trim())
      throw new BadRequestException('Giải offline/hybrid cần địa điểm.');
    if (dto.rounds) {
      dto.rounds = await Promise.all(dto.rounds.map((r) => this.round(r)));
      const violation = new TournamentFormatPolicy().validateSequence(
        dto.rounds.map((r) => r.format),
      );
      if (violation) throw new BadRequestException(violation.message);
    }
    return {
      kind: 'create',
      targetName: dto.name,
      gameName: game.name,
      payload: { ...dto },
    };
  }

  private async round(value: unknown) {
    if (!record(value))
      throw new BadRequestException('Cấu hình vòng đấu chưa hợp lệ.');
    const dto = plainToInstance(CreateRoundDto, value);
    await validateProposalDto(dto);
    dto.bestOf ??= 1;
    dto.settings = {
      ...(await this.settings.normalizeForFormat(
        dto.format,
        dto.settings,
        dto.bestOf,
      )),
    };
    return dto;
  }
}
