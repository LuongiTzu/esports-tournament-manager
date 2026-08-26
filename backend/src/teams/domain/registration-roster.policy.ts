import { GamePositionMode, MemberRole } from '@prisma/client';
import { RegistrationMemberInput } from '../types/registration-member-input';
import {
  RegistrationError,
  RegistrationRules,
} from '../types/registration-rules';

export function isActivePlayerRole(role: MemberRole): boolean {
  return role === MemberRole.CAPTAIN || role === MemberRole.PLAYER;
}

export function isPlayerRosterRole(role: MemberRole): boolean {
  return isActivePlayerRole(role) || role === MemberRole.SUBSTITUTE;
}

function memberRole(member: RegistrationMemberInput): MemberRole {
  return member.memberRole ?? MemberRole.PLAYER;
}

export class RegistrationRosterPolicy {
  validate(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
  ): { captainIndex: number; errors: RegistrationError[] } {
    const errors: RegistrationError[] = [];
    const captainIndex = resolveCaptainIndex(members);
    this.checkRosterSize(rules, members, errors);
    this.checkCaptain(members, errors);
    this.checkMembers(rules, members, errors);
    this.checkPositions(rules, members, errors);
    this.checkDuplicatesWithinTeam(members, errors);
    return { captainIndex, errors };
  }

  private checkRosterSize(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
    errors: RegistrationError[],
  ) {
    const activePlayers = members.filter((member) =>
      isActivePlayerRole(memberRole(member)),
    ).length;
    const playerRoster = members.filter((member) =>
      isPlayerRosterRole(memberRole(member)),
    ).length;
    const substitutes = members.filter(
      (member) => memberRole(member) === MemberRole.SUBSTITUTE,
    ).length;
    const maxSubstitutes = rules.maxTeamSize - rules.minTeamSize;

    if (activePlayers !== rules.minTeamSize) {
      errors.push({
        field: 'members',
        memberIndex: null,
        message: `Đội phải có đúng ${rules.minTeamSize} thành viên thi đấu chính (hiện có ${activePlayers})`,
      });
    }

    if (playerRoster > rules.maxTeamSize) {
      errors.push({
        field: 'members',
        memberIndex: null,
        message: `Đội chỉ được có tối đa ${rules.maxTeamSize} thành viên trong roster (hiện có ${playerRoster})`,
      });
    }

    if (substitutes > maxSubstitutes) {
      errors.push({
        field: 'members',
        memberIndex: null,
        message: `Giải chỉ cho phép tối đa ${maxSubstitutes} thành viên dự bị (hiện có ${substitutes})`,
      });
    }
  }

  private checkCaptain(
    members: RegistrationMemberInput[],
    errors: RegistrationError[],
  ) {
    const captains = members
      .map((member, index) => ({ role: member.memberRole, index }))
      .filter((member) => member.role === MemberRole.CAPTAIN);

    if (captains.length === 0) {
      errors.push({
        field: 'memberRole',
        memberIndex: null,
        message: 'Đội phải có đúng 1 đội trưởng',
      });
      return;
    }

    for (const extra of captains.slice(1)) {
      errors.push({
        field: 'memberRole',
        memberIndex: extra.index,
        message: 'Đội chỉ được có đúng 1 đội trưởng',
      });
    }
  }

  private checkMembers(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
    errors: RegistrationError[],
  ) {
    const hasAgeLimit = rules.minAge !== null || rules.maxAge !== null;
    const ageReference = rules.startDate ?? new Date();

    members.forEach((member, index) => {
      if (rules.requireMemberFullInfo) {
        const missing: [string, unknown][] = [
          ['realName', member.realName?.trim()],
          ['birthDate', member.birthDate],
          ['gender', member.gender],
        ];

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
    });
  }

  private checkPositions(
    rules: RegistrationRules,
    members: RegistrationMemberInput[],
    errors: RegistrationError[],
  ) {
    const allowedPositions = new Set(rules.positions);

    if (rules.positionMode === GamePositionMode.NONE) {
      members.forEach((member, index) => {
        if (member.position?.trim()) {
          errors.push({
            field: 'position',
            memberIndex: index,
            message: 'Game này không sử dụng vị trí thi đấu',
          });
        }
      });
      return;
    }

    const activePositions = new Set<string>();
    members.forEach((member, index) => {
      const role = memberRole(member);
      const position = member.position?.trim();
      const isActive = isActivePlayerRole(role);

      if (
        rules.positionMode === GamePositionMode.FIXED &&
        isActive &&
        !position
      ) {
        errors.push({
          field: 'position',
          memberIndex: index,
          message: 'Thành viên thi đấu chính phải có vị trí',
        });
        return;
      }

      if (!position) return;

      if (!allowedPositions.has(position)) {
        errors.push({
          field: 'position',
          memberIndex: index,
          message: `Vị trí không hợp lệ. Các vị trí của game này: ${rules.positions.join(', ')}`,
        });
        return;
      }

      if (
        rules.positionMode === GamePositionMode.FIXED &&
        isActive &&
        activePositions.has(position)
      ) {
        errors.push({
          field: 'position',
          memberIndex: index,
          message: 'Vị trí thi đấu chính bị trùng với thành viên khác',
        });
        return;
      }

      if (rules.positionMode === GamePositionMode.FIXED && isActive) {
        activePositions.add(position);
      }
    });

    if (rules.positionMode === GamePositionMode.FIXED) {
      const missingPositions = rules.positions.filter(
        (position) => !activePositions.has(position),
      );
      if (missingPositions.length) {
        errors.push({
          field: 'position',
          memberIndex: null,
          message: `Đội hình chính còn thiếu vị trí: ${missingPositions.join(', ')}`,
        });
      }
    }
  }

  private checkDuplicatesWithinTeam(
    members: RegistrationMemberInput[],
    errors: RegistrationError[],
  ) {
    collectDuplicateIndexes(
      members.map((member) => member.ign?.trim().toLowerCase()),
    ).forEach((index) =>
      errors.push({
        field: 'ign',
        memberIndex: index,
        message: 'IGN bị trùng với thành viên khác trong đội',
      }),
    );

    collectDuplicateIndexes(
      members.map((member) => member.inGameId?.trim().toLowerCase()),
    ).forEach((index) =>
      errors.push({
        field: 'inGameId',
        memberIndex: index,
        message: 'ID game bị trùng với thành viên khác trong đội',
      }),
    );
  }
}

export function resolveCaptainIndex(
  members: RegistrationMemberInput[],
): number {
  return members.findIndex(
    (member) => member.memberRole === MemberRole.CAPTAIN,
  );
}

const FIELD_LABELS: Record<string, string> = {
  realName: 'tên thật',
  birthDate: 'ngày sinh',
  gender: 'giới tính',
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
