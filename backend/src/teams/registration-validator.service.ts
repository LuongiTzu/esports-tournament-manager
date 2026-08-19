import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  GamePositionMode,
  Gender,
  MemberRole,
  RegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberInputDto } from './dto/register-team.dto';

/** Một lỗi nghiệp vụ — FE dùng `memberIndex` + `field` để highlight đúng ô sai */
export interface RegistrationError {
  field: string;
  memberIndex: number | null;
  message: string;
}

/** Ràng buộc đăng ký lấy từ snapshot của giải đấu. */
export interface RegistrationRules {
  tournamentId: string;
  minTeamSize: number;
  maxTeamSize: number;
  maxSubstitutes: number;
  minAge: number | null;
  maxAge: number | null;
  allowedGenders: Gender[] | null;
  requireMemberFullInfo: boolean;
  startDate: Date | null;
  positions: string[];
  positionMode: GamePositionMode;
}

/** Vai trò không tính vào sức chứa đội hình thi đấu */
const NON_PLAYING_ROLES: MemberRole[] = [MemberRole.COACH, MemberRole.MANAGER];

/**
 * Validate các rule đăng ký phụ thuộc dữ liệu DB (Tournament + Game) — GĐ 4.3.
 *
 * Khác với class-validator ở DTO, các rule ở đây cần đọc ràng buộc của giải nên
 * không thể làm bằng decorator. Toàn bộ lỗi được gom lại và trả về 1 lần (không
 * fail-fast) để FE highlight đồng thời mọi ô sai.
 */
@Injectable()
export class RegistrationValidatorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Đọc snapshot `minTeamSize`/`maxTeamSize` của giải và chuẩn hóa dữ liệu Json.
   */
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
      maxSubstitutes: tournament.maxTeamSize - tournament.minTeamSize,
      minAge: tournament.minAge,
      maxAge: tournament.maxAge,
      allowedGenders: toGenderList(tournament.allowedGenders),
      requireMemberFullInfo: tournament.requireMemberFullInfo,
      startDate: tournament.startDate,
      positions: toStringList(tournament.game.positions),
      positionMode: tournament.game.positionMode,
    };
  }

  /**
   * Chạy toàn bộ rule nghiệp vụ. Ném 422 kèm mảng lỗi nếu có vi phạm,
   * ngược lại trả về vị trí đội trưởng đã chốt để caller ghi DB.
   *
   * @param excludeTeamId Bỏ qua đội này khi check trùng chéo (dùng khi sửa roster của chính đội đó)
   */
  async validate(
    rules: RegistrationRules,
    members: TeamMemberInputDto[],
    excludeTeamId?: string,
  ): Promise<{ captainIndex: number }> {
    const errors: RegistrationError[] = [];

    const captainIndex = resolveCaptainIndex(members);

    this.checkTeamSize(rules, members, errors);
    this.checkSubstitutes(rules, members, errors);
    this.checkCaptain(members, errors);
    this.checkMembers(rules, members, captainIndex, errors);
    this.checkDuplicatesWithinTeam(members, errors);
    await this.checkCrossTeamDuplicates(rules, members, errors, excludeTeamId);

    if (errors.length) {
      throw new UnprocessableEntityException({
        message: 'Hồ sơ đăng ký chưa hợp lệ',
        errors,
      });
    }

    return { captainIndex };
  }

  // ─── Rule đội hình ──────────────────────────────────────────

  /** HLV/Quản lý không chiếm suất thi đấu nên không tính vào [min, max] */
  private checkTeamSize(
    rules: RegistrationRules,
    members: TeamMemberInputDto[],
    errors: RegistrationError[],
  ) {
    const playing = members.filter(
      (m) => !NON_PLAYING_ROLES.includes(m.memberRole ?? MemberRole.PLAYER),
    ).length;

    if (playing < rules.minTeamSize) {
      errors.push({
        field: 'members',
        memberIndex: null,
        message: `Đội phải có tối thiểu ${rules.minTeamSize} thành viên thi đấu (hiện có ${playing})`,
      });
    }

    if (playing > rules.maxTeamSize) {
      errors.push({
        field: 'members',
        memberIndex: null,
        message: `Đội chỉ được có tối đa ${rules.maxTeamSize} thành viên thi đấu (hiện có ${playing})`,
      });
    }
  }

  private checkSubstitutes(
    rules: RegistrationRules,
    members: TeamMemberInputDto[],
    errors: RegistrationError[],
  ) {
    const substitutes = members.filter(
      (m) => m.memberRole === MemberRole.SUBSTITUTE,
    ).length;

    if (substitutes > rules.maxSubstitutes) {
      errors.push({
        field: 'members',
        memberIndex: null,
        message: `Giải chỉ cho phép tối đa ${rules.maxSubstitutes} thành viên dự bị (hiện có ${substitutes})`,
      });
    }
  }

  /**
   * Thiếu đội trưởng không phải lỗi — thành viên đầu tiên sẽ được gán tự động.
   * Nhưng gửi lên nhiều hơn 1 đội trưởng là mâu thuẫn dữ liệu, phải báo lỗi.
   */
  private checkCaptain(
    members: TeamMemberInputDto[],
    errors: RegistrationError[],
  ) {
    const captains = members
      .map((m, index) => ({ role: m.memberRole, index }))
      .filter((m) => m.role === MemberRole.CAPTAIN);

    for (const extra of captains.slice(1)) {
      errors.push({
        field: 'memberRole',
        memberIndex: extra.index,
        message: 'Đội chỉ được có đúng 1 đội trưởng',
      });
    }
  }

  // ─── Rule từng thành viên ───────────────────────────────────

  private checkMembers(
    rules: RegistrationRules,
    members: TeamMemberInputDto[],
    captainIndex: number,
    errors: RegistrationError[],
  ) {
    const hasAgeLimit = rules.minAge !== null || rules.maxAge !== null;
    // Tuổi tính tại ngày khai mạc để đội không bị lệch điều kiện giữa lúc đăng ký và lúc đá
    const ageReference = rules.startDate ?? new Date();

    members.forEach((member, index) => {
      const effectiveRole =
        index === captainIndex
          ? MemberRole.CAPTAIN
          : (member.memberRole ?? MemberRole.PLAYER);
      const isPlaying = !NON_PLAYING_ROLES.includes(effectiveRole);

      if (rules.requireMemberFullInfo) {
        const missing: [string, unknown][] = [
          ['realName', member.realName?.trim()],
          ['birthDate', member.birthDate],
          ['gender', member.gender],
        ];
        if (
          isPlaying &&
          rules.positionMode === GamePositionMode.FIXED &&
          rules.positions.length
        ) {
          missing.push(['position', member.position?.trim()]);
        }

        for (const [field, value] of missing) {
          if (!value) {
            errors.push({
              field,
              memberIndex: index,
              message: `Giải này bắt buộc điền đầy đủ hồ sơ: thiếu ${FIELD_LABELS[field]}`,
            });
          }
        }
      }

      if (hasAgeLimit) {
        if (!member.birthDate) {
          errors.push({
            field: 'birthDate',
            memberIndex: index,
            message: 'Giải có giới hạn độ tuổi nên ngày sinh là bắt buộc',
          });
        } else {
          const age = ageAt(new Date(member.birthDate), ageReference);
          if (rules.minAge !== null && age < rules.minAge) {
            errors.push({
              field: 'birthDate',
              memberIndex: index,
              message: `Thành viên phải từ ${rules.minAge} tuổi trở lên (hiện ${age} tuổi tính tại ngày khai mạc)`,
            });
          }
          if (rules.maxAge !== null && age > rules.maxAge) {
            errors.push({
              field: 'birthDate',
              memberIndex: index,
              message: `Thành viên không được quá ${rules.maxAge} tuổi (hiện ${age} tuổi tính tại ngày khai mạc)`,
            });
          }
        }
      }

      if (rules.allowedGenders) {
        if (!member.gender) {
          errors.push({
            field: 'gender',
            memberIndex: index,
            message: 'Giải có giới hạn giới tính nên giới tính là bắt buộc',
          });
        } else if (!rules.allowedGenders.includes(member.gender)) {
          errors.push({
            field: 'gender',
            memberIndex: index,
            message: `Giải chỉ nhận thành viên có giới tính: ${rules.allowedGenders.join(', ')}`,
          });
        }
      }

      const position = member.position?.trim();
      if (position && rules.positionMode === GamePositionMode.NONE) {
        errors.push({
          field: 'position',
          memberIndex: index,
          message: 'Game này không sử dụng vị trí thi đấu',
        });
      } else if (position && !rules.positions.includes(position)) {
        errors.push({
          field: 'position',
          memberIndex: index,
          message: `Vị trí không hợp lệ. Các vị trí của game này: ${rules.positions.join(', ')}`,
        });
      }
    });
  }

  // ─── Rule trùng lặp ─────────────────────────────────────────

  private checkDuplicatesWithinTeam(
    members: TeamMemberInputDto[],
    errors: RegistrationError[],
  ) {
    collectDuplicateIndexes(
      members.map((m) => m.ign?.trim().toLowerCase()),
    ).forEach((index) =>
      errors.push({
        field: 'ign',
        memberIndex: index,
        message: 'IGN bị trùng với thành viên khác trong đội',
      }),
    );

    collectDuplicateIndexes(
      members.map((m) => m.inGameId?.trim().toLowerCase()),
    ).forEach((index) =>
      errors.push({
        field: 'inGameId',
        memberIndex: index,
        message: 'ID game bị trùng với thành viên khác trong đội',
      }),
    );
  }

  /**
   * Chống đăng ký chéo: 1 người (theo IGN hoặc ID game) không được xuất hiện
   * ở 2 đội khác nhau trong cùng 1 giải. Đội đã bị từ chối không tính.
   */
  private async checkCrossTeamDuplicates(
    rules: RegistrationRules,
    members: TeamMemberInputDto[],
    errors: RegistrationError[],
    excludeTeamId?: string,
  ) {
    const igns = uniqueValues(members.map((m) => m.ign));
    const inGameIds = uniqueValues(members.map((m) => m.inGameId));

    if (!igns.length && !inGameIds.length) {
      return;
    }

    const taken = await this.prisma.teamMember.findMany({
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

// ─── Module helpers ───────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  realName: 'tên thật',
  birthDate: 'ngày sinh',
  gender: 'giới tính',
  position: 'vị trí thi đấu',
};

/**
 * Vị trí đội trưởng đã chốt. FE không gửi CAPTAIN nào → thành viên đầu tiên.
 * Dùng chung giữa validator và lúc ghi DB để 2 nơi không lệch nhau.
 */
export function resolveCaptainIndex(members: TeamMemberInputDto[]): number {
  const index = members.findIndex((m) => m.memberRole === MemberRole.CAPTAIN);
  return index === -1 ? 0 : index;
}

/** Tuổi tại một thời điểm mốc (đã trừ trường hợp chưa tới sinh nhật trong năm) */
function ageAt(birthDate: Date, reference: Date): number {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && reference.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/** Index của các phần tử xuất hiện lần thứ 2 trở đi (bỏ qua giá trị rỗng) */
function collectDuplicateIndexes(values: (string | undefined)[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];

  values.forEach((value, index) => {
    if (!value) return;
    if (seen.has(value)) {
      duplicates.push(index);
    } else {
      seen.add(value);
    }
  });

  return duplicates;
}

function uniqueValues(values: (string | undefined)[]): string[] {
  return [
    ...new Set(
      values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)),
    ),
  ];
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

function toGenderList(value: unknown): Gender[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter(
    (v): v is Gender => typeof v === 'string' && v in Gender,
  );
  return list.length ? list : null;
}
