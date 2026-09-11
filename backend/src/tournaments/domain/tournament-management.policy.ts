import { TournamentStatus } from '@prisma/client';

export const managementReasons = {
  SETUP_CLOSED:
    'Giải đã bắt đầu hoặc kết thúc, không thể thay đổi cấu hình và danh sách đội.',
  TEAMS_EXIST: 'Cấu hình đã khóa vì đã có hồ sơ đội đăng ký.',
  STRUCTURE_EXISTS: 'Danh sách đội đã khóa vì đã sinh cấu trúc thi đấu.',
  REGISTRATION_CLOSED: 'Ban tổ chức đã đóng đăng ký.',
  REGISTRATION_NOT_STARTED: 'Chưa đến thời điểm nhận đăng ký.',
  REGISTRATION_EXPIRED: 'Đã hết hạn đăng ký.',
  TOURNAMENT_STARTED: 'Giải đã đến thời điểm bắt đầu, không nhận thêm đăng ký.',
  CAPACITY_REACHED: 'Giải đã đủ số đội tham gia.',
  STATUS_NOT_REGISTRATION: 'Giải hiện không ở giai đoạn đăng ký.',
  REGISTRATION_MUST_BE_CLOSED: 'Đóng đăng ký trước khi bắt đầu giải.',
  NOT_ENOUGH_TEAMS: 'Cần ít nhất hai đội được duyệt.',
  FIRST_ROUND_NOT_GENERATED:
    'Sinh lịch thi đấu vòng đầu trước khi bắt đầu giải.',
} as const;

export type ManagementReason = keyof typeof managementReasons;

export function setupStatusReason(
  status: TournamentStatus,
): ManagementReason | null {
  return status === TournamentStatus.DRAFT ||
    status === TournamentStatus.REGISTRATION
    ? null
    : 'SETUP_CLOSED';
}

export function participantLockReason(
  status: TournamentStatus,
  hasStructure: boolean,
): ManagementReason | null {
  return (
    setupStatusReason(status) ?? (hasStructure ? 'STRUCTURE_EXISTS' : null)
  );
}

export function gameConfigurationLockReason(
  status: TournamentStatus,
  teamCount: number,
  hasStructure: boolean,
): ManagementReason | null {
  return (
    participantLockReason(status, hasStructure) ??
    (teamCount > 0 ? 'TEAMS_EXIST' : null)
  );
}

export interface RegistrationWindow {
  status: TournamentStatus;
  registrationOpen: boolean;
  registrationStartDate: Date | null;
  registrationDeadline: Date | null;
  startDate: Date | null;
}

export function registrationWindowReason(
  tournament: RegistrationWindow,
  now = new Date(),
): ManagementReason | null {
  if (tournament.status !== TournamentStatus.REGISTRATION)
    return 'STATUS_NOT_REGISTRATION';
  if (tournament.startDate && now >= tournament.startDate)
    return 'TOURNAMENT_STARTED';
  if (!tournament.registrationOpen) return 'REGISTRATION_CLOSED';
  if (
    tournament.registrationStartDate &&
    now < tournament.registrationStartDate
  )
    return 'REGISTRATION_NOT_STARTED';
  if (tournament.registrationDeadline && now > tournament.registrationDeadline)
    return 'REGISTRATION_EXPIRED';
  return null;
}

export function tournamentStartReasons(
  status: TournamentStatus,
  registrationOpen: boolean,
  approvedCount: number,
  firstRoundMatchCount: number,
): ManagementReason[] {
  if (status !== TournamentStatus.REGISTRATION)
    return ['STATUS_NOT_REGISTRATION'];
  const reasons: ManagementReason[] = [];
  if (registrationOpen) reasons.push('REGISTRATION_MUST_BE_CLOSED');
  if (approvedCount < 2) reasons.push('NOT_ENOUGH_TEAMS');
  if (firstRoundMatchCount === 0) reasons.push('FIRST_ROUND_NOT_GENERATED');
  return reasons;
}

export function managementAction(reason: ManagementReason | null) {
  return { allowed: reason === null, reason };
}
