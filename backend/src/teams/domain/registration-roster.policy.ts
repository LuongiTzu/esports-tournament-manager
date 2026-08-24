import { GamePositionMode, MemberRole } from '@prisma/client';
import { RegistrationMemberInput } from '../types/registration-member-input';
import {
  RegistrationError,
  RegistrationRules,
} from '../types/registration-rules';

const NON_PLAYING_ROLES: MemberRole[] = [MemberRole.COACH, MemberRole.MANAGER];

export class RegistrationRosterPolicy {
  validate(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
  ): { captainIndex: number; errors: RegistrationError[] } {
    const errors: RegistrationError[] = [];
    const captainIndex = resolveCaptainIndex(members);
    this.checkTeamSize(rules, members, errors);
    this.checkSubstitutes(rules, members, errors);
    this.checkCaptain(members, errors);
    this.checkMembers(rules, members, captainIndex, errors);
    this.checkDuplicatesWithinTeam(members, errors);
    return { captainIndex, errors };
  }

  private checkTeamSize(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
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
    members: RegistrationMemberInput[],
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
    members: RegistrationMemberInput[],
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
    members: RegistrationMemberInput[],
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
    members: RegistrationMemberInput[],
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
}

export function resolveCaptainIndex(
  members: RegistrationMemberInput[],
): number {
  const index = members.findIndex(
    (member) => member.memberRole === MemberRole.CAPTAIN,
  );
  return index === -1 ? 0 : index;
}

const FIELD_LABELS: Record<string, string> = {
  realName: 'tên thật',
  birthDate: 'ngày sinh',
  gender: 'giới tính',
  position: 'vị trí thi đấu',
};

function ageAt(birthDate: Date, reference: Date): number {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && reference.getDate() < birthDate.getDate())
  )
    age--;
  return age;
}

function collectDuplicateIndexes(values: (string | undefined)[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  values.forEach((value, index) => {
    if (!value) return;
    if (seen.has(value)) duplicates.push(index);
    else seen.add(value);
  });
  return duplicates;
}
