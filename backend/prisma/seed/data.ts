import {
  Gender,
  ModerationStatus,
  Role,
  RoundFormat,
  TournamentMode,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import {
  DoubleElimSettings,
  GroupStageSettings,
  PlayoffSettings,
  RoundRobinSettings,
  SwissSettings,
} from '../../src/brackets/types/round-settings';

export const DEVELOPMENT_PASSWORD = '12345678';
export const SEED_EMAIL_DOMAIN = 'du-lieu-giai-dau.test';
export const SEED_SLUG_PREFIX = 'du-lieu-viet-';

export type SeedPersona =
  'ADMIN' | 'ORGANIZER' | 'HYBRID' | 'PARTICIPANT' | 'SPECTATOR';

export interface SeedUserSpec {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  persona: SeedPersona;
  gender: Gender;
  phoneNumber: string;
  birthDate: string;
  currentAddress: string;
  bio: string;
  isLocked: boolean;
}

interface RoundBase {
  key: string;
  name: string;
  bestOf: number;
}

export type SeedRoundSpec =
  | (RoundBase & {
      format: typeof RoundFormat.ROUND_ROBIN;
      settings: RoundRobinSettings;
    })
  | (RoundBase & {
      format: typeof RoundFormat.GROUP_STAGE;
      settings: GroupStageSettings;
    })
  | (RoundBase & { format: typeof RoundFormat.SWISS; settings: SwissSettings })
  | (RoundBase & {
      format: typeof RoundFormat.PLAYOFF;
      settings: PlayoffSettings;
    })
  | (RoundBase & {
      format: typeof RoundFormat.DOUBLE_ELIM;
      settings: DoubleElimSettings;
    });

export interface SeedTournamentSpec {
  id: string;
  name: string;
  slug: string;
  gameCode: string;
  teamSize?: number;
  organizerIndex: number;
  description: string;
  rules: string;
  status: TournamentStatus;
  visibility: Visibility;
  moderationStatus: ModerationStatus;
  isVerified: boolean;
  isOfficial: boolean;
  mode: TournamentMode;
  location: string | null;
  maxTeams: number;
  maxTeamSize: number;
  approvedTeams: number;
  pendingTeams: number;
  rejectedTeams: number;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationDeadline: string;
  competition: 'NONE' | 'PARTIAL' | 'COMPLETE';
  partialMatchLimit?: number;
  swissCompletedRounds?: number;
  forceGrandFinalReset?: boolean;
  rounds: SeedRoundSpec[];
}

const familyNames = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
];
const givenNames = [
  'Minh Anh',
  'Quốc Bảo',
  'Hoàng Nam',
  'Thùy Linh',
  'Đức Huy',
  'Gia Hân',
  'Tuấn Kiệt',
  'Ngọc Mai',
  'Thanh Tùng',
  'Khánh Vy',
];
const provinces = [
  'Hà Nội',
  'Thành phố Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Huế',
  'Nha Trang',
  'Đà Lạt',
  'Biên Hòa',
  'Vũng Tàu',
];

function personaFor(index: number): SeedPersona {
  if (index < 3) return 'ADMIN';
  if (index < 33) return 'ORGANIZER';
  if (index < 45) return 'HYBRID';
  if (index < 120) return 'PARTICIPANT';
  return 'SPECTATOR';
}

const personaBio: Record<SeedPersona, string> = {
  ADMIN: 'Quản trị viên phụ trách vận hành và an toàn cộng đồng.',
  ORGANIZER: 'Thành viên tập trung tổ chức các giải đấu cộng đồng.',
  HYBRID: 'Vừa tổ chức giải đấu, vừa thi đấu và theo dõi cộng đồng.',
  PARTICIPANT: 'Tuyển thủ yêu thích thi đấu và giao lưu cùng các đội tuyển.',
  SPECTATOR: 'Khán giả thường xuyên theo dõi, bình luận và cổ vũ giải đấu.',
};

export const SEED_USERS: SeedUserSpec[] = Array.from(
  { length: 150 },
  (_, index) => {
    const persona = personaFor(index);
    const ordinal = index + 1;
    return {
      id: `seed-user-${String(ordinal).padStart(3, '0')}`,
      email: `thanh-vien-${String(ordinal).padStart(3, '0')}@${SEED_EMAIL_DOMAIN}`,
      displayName: `${familyNames[index % familyNames.length]} ${givenNames[Math.floor(index / familyNames.length) % givenNames.length]}`,
      role: persona === 'ADMIN' ? Role.ADMIN : Role.SIGNED_UP_USER,
      persona,
      gender: [Gender.MALE, Gender.FEMALE, Gender.OTHER][index % 3],
      phoneNumber: `090${String(1000000 + ordinal).slice(-7)}`,
      birthDate: `${1988 + (index % 16)}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 24) + 1).padStart(2, '0')}`,
      currentAddress: provinces[index % provinces.length],
      bio: personaBio[persona],
      isLocked: [58, 79, 101, 124, 133, 141, 148].includes(ordinal),
    };
  },
);

export const VIETNAMESE_MEMBER_NAMES = SEED_USERS.map(
  (user) => user.displayName,
);

export const TEAM_NAMES = [
  'Sài Gòn Hỏa Long',
  'Hà Nội Sao Khuê',
  'Đà Nẵng Hải Ưng',
  'Cần Thơ Phù Sa',
  'Huế Ngự Lâm',
  'Hải Phòng Sóng Đỏ',
  'Nha Trang Kình Ngư',
  'Đà Lạt Thông Xanh',
  'Biên Hòa Lôi Báo',
  'Vũng Tàu Hải Đăng',
  'Bắc Ninh Kinh Bắc',
  'Quảng Ninh Hắc Long',
  'Thanh Hóa Lam Sơn',
  'Nghệ An Sông Lam',
  'Bình Dương Thép Xanh',
  'Đồng Nai Chiến Tượng',
  'An Giang Thất Sơn',
  'Kiên Giang Biển Ngọc',
  'Quảng Nam Hoài Phố',
  'Bình Định Tây Sơn',
];

const gameDistribution: Array<[string, number]> = [
  ['LIEN_QUAN_MOBILE', 17],
  ['LEAGUE_OF_LEGENDS', 15],
  ['VALORANT', 8],
  ['COUNTER_STRIKE_2', 7],
  ['DOTA_2', 6],
  ['MLBB', 5],
  ['HONOR_OF_KINGS', 4],
  ['WILD_RIFT', 4],
  ['FC_ONLINE', 4],
  ['CROSSFIRE_PC', 4],
  ['TEKKEN_8', 3],
  ['ROCKET_LEAGUE', 3],
];

type CompetitionPlan =
  | 'SWISS_PLAYOFF'
  | 'SWISS_DOUBLE'
  | 'GROUP_PLAYOFF'
  | 'GROUP_DOUBLE'
  | 'ROUND_ROBIN_PLAYOFF'
  | 'ROUND_ROBIN_DOUBLE'
  | 'PLAYOFF_ONLY'
  | 'DOUBLE_ONLY'
  | 'ROUND_ROBIN_ONLY'
  | 'GROUP_ONLY';

const competitionPlans: CompetitionPlan[] = [
  ...Array<CompetitionPlan>(24).fill('SWISS_PLAYOFF'),
  ...Array<CompetitionPlan>(6).fill('SWISS_DOUBLE'),
  ...Array<CompetitionPlan>(14).fill('GROUP_PLAYOFF'),
  ...Array<CompetitionPlan>(6).fill('GROUP_DOUBLE'),
  ...Array<CompetitionPlan>(8).fill('ROUND_ROBIN_PLAYOFF'),
  ...Array<CompetitionPlan>(4).fill('ROUND_ROBIN_DOUBLE'),
  ...Array<CompetitionPlan>(8).fill('PLAYOFF_ONLY'),
  ...Array<CompetitionPlan>(4).fill('DOUBLE_ONLY'),
  ...Array<CompetitionPlan>(4).fill('ROUND_ROBIN_ONLY'),
  ...Array<CompetitionPlan>(2).fill('GROUP_ONLY'),
];

const tournamentThemes = [
  'Hào Khí',
  'Rồng Việt',
  'Sao Khuê',
  'Hải Đăng',
  'Ngọn Lửa Trẻ',
  'Đường Đến Vinh Quang',
  'Khát Vọng Việt',
  'Đỉnh Cao Chiến Thuật',
  'Bản Lĩnh Anh Tài',
  'Sức Trẻ Ba Miền',
];
const tournamentKinds = [
  'Cúp Mùa Thu',
  'Giải Sinh Viên',
  'Giải Cộng Đồng',
  'Đại Chiến Khu Vực',
  'Cúp Mở Rộng',
  'Giải Tranh Hạng',
  'Ngày Hội Thể Thao Điện Tử',
  'Cúp Anh Tài',
];
const gameLabels: Record<string, string> = {
  LIEN_QUAN_MOBILE: 'Liên Quân',
  LEAGUE_OF_LEGENDS: 'Liên Minh Huyền Thoại',
  VALORANT: 'Valorant',
  COUNTER_STRIKE_2: 'Phản Công 2',
  DOTA_2: 'Dota 2',
  MLBB: 'Bang Bang',
  HONOR_OF_KINGS: 'Vương Giả Vinh Diệu',
  WILD_RIFT: 'Tốc Chiến',
  FC_ONLINE: 'Bóng Đá Trực Tuyến',
  CROSSFIRE_PC: 'Đột Kích',
  TEKKEN_8: 'Thiết Quyền',
  ROCKET_LEAGUE: 'Bóng Đá Tên Lửa',
};

const expandedGames = gameDistribution.flatMap(([gameCode, count]) =>
  Array<string>(count).fill(gameCode),
);

function statusFor(index: number): TournamentStatus {
  if (index < 30) return TournamentStatus.COMPLETED;
  if (index < 50) return TournamentStatus.ONGOING;
  if (index < 68) return TournamentStatus.REGISTRATION;
  if (index < 76) return TournamentStatus.DRAFT;
  return TournamentStatus.CANCELLED;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function startDateFor(index: number, status: TournamentStatus): Date {
  if (status === TournamentStatus.COMPLETED)
    return addDays(new Date('2026-08-01T02:00:00.000Z'), index % 25);
  if (status === TournamentStatus.ONGOING)
    return addDays(new Date('2026-08-25T02:00:00.000Z'), (index - 30) % 12);
  if (status === TournamentStatus.REGISTRATION)
    return addDays(new Date('2026-09-10T02:00:00.000Z'), (index - 50) % 6);
  if (status === TournamentStatus.DRAFT)
    return addDays(new Date('2026-09-12T02:00:00.000Z'), (index - 68) % 4);
  return addDays(new Date('2026-09-03T02:00:00.000Z'), index - 76);
}

function roundsFor(plan: CompetitionPlan, index: number): SeedRoundSpec[] {
  const swiss: SeedRoundSpec = {
    key: 'vong-thuy-si',
    name: 'Vòng Thụy Sĩ',
    format: RoundFormat.SWISS,
    bestOf: 3,
    settings:
      index < 27
        ? {
            mode: 'THRESHOLD',
            winsToAdvance: 3,
            lossesToEliminate: 3,
            numberOfRounds: 5,
            advancingTeamCount: 8,
          }
        : { mode: 'FIXED_ROUNDS', numberOfRounds: 4, advancingTeamCount: 8 },
  };
  const group: SeedRoundSpec = {
    key: 'vong-bang',
    name: 'Vòng bảng',
    format: RoundFormat.GROUP_STAGE,
    bestOf: index % 3 === 0 ? 3 : 1,
    settings: {
      numberOfGroups: 4,
      advancingTeamsPerGroup: 2,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: index % 4 === 0,
      meetingsPerPair: 1,
    },
  };
  const roundRobin: SeedRoundSpec = {
    key: 'vong-tron',
    name: 'Vòng tròn tính điểm',
    format: RoundFormat.ROUND_ROBIN,
    bestOf: index % 2 === 0 ? 3 : 1,
    settings: {
      advancingTeamCount: 4,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: index % 3 === 0,
      meetingsPerPair: index % 5 === 0 ? 2 : 1,
    },
  };
  const playoff: SeedRoundSpec = {
    key: 'vong-loai-truc-tiep',
    name: 'Vòng loại trực tiếp',
    format: RoundFormat.PLAYOFF,
    bestOf: index % 4 === 0 ? 5 : 3,
    settings: { thirdPlaceMatch: index % 3 === 0 },
  };
  const doubleElim: SeedRoundSpec = {
    key: 'nhanh-thang-nhanh-thua',
    name: 'Nhánh thắng – nhánh thua',
    format: RoundFormat.DOUBLE_ELIM,
    bestOf: index % 4 === 0 ? 5 : 3,
    settings: { grandFinalReset: index === 29 || index === 58 },
  };
  switch (plan) {
    case 'SWISS_PLAYOFF':
      return [swiss, playoff];
    case 'SWISS_DOUBLE':
      return [swiss, doubleElim];
    case 'GROUP_PLAYOFF':
      return [group, playoff];
    case 'GROUP_DOUBLE':
      return [group, doubleElim];
    case 'ROUND_ROBIN_PLAYOFF':
      return [roundRobin, playoff];
    case 'ROUND_ROBIN_DOUBLE':
      return [roundRobin, doubleElim];
    case 'PLAYOFF_ONLY':
      return [playoff];
    case 'DOUBLE_ONLY':
      return [doubleElim];
    case 'ROUND_ROBIN_ONLY':
      return [roundRobin];
    case 'GROUP_ONLY':
      return [group];
  }
}

function approvedTeamCount(plan: CompetitionPlan): number {
  return plan.startsWith('SWISS') || plan.startsWith('GROUP') ? 16 : 8;
}

export const SEED_TOURNAMENTS: SeedTournamentSpec[] = expandedGames.map(
  (gameCode, index) => {
    const status = statusFor(index);
    const plan = competitionPlans[index];
    const startDate = startDateFor(index, status);
    const competition =
      status === TournamentStatus.COMPLETED
        ? 'COMPLETE'
        : status === TournamentStatus.ONGOING
          ? 'PARTIAL'
          : 'NONE';
    const expectedApproved = approvedTeamCount(plan);
    const approvedTeams =
      competition === 'NONE' ? (index % 6) + 1 : expectedApproved;
    const pendingTeams =
      status === TournamentStatus.REGISTRATION ? 2 + (index % 4) : 0;
    const rejectedTeams =
      status === TournamentStatus.DRAFT ? 0 : index % 3 === 0 ? 1 : 0;
    const ordinal = index + 1;
    const region = provinces[index % provinces.length];
    const name = `${tournamentThemes[index % tournamentThemes.length]} – ${tournamentKinds[Math.floor(index / 10) % tournamentKinds.length]} ${gameLabels[gameCode]} ${region} 2026`;
    const mode = [
      TournamentMode.ONLINE,
      TournamentMode.OFFLINE,
      TournamentMode.HYBRID,
    ][index % 3];
    return {
      id: `seed-tournament-${String(ordinal).padStart(3, '0')}`,
      name,
      slug: `${SEED_SLUG_PREFIX}${String(ordinal).padStart(3, '0')}`,
      gameCode,
      organizerIndex: index % 42,
      description: `${name} quy tụ các đội tuyển giàu nhiệt huyết, hướng đến môi trường thi đấu công bằng và chuyên nghiệp.`,
      rules:
        'Các đội có mặt đúng giờ, sử dụng đội hình đã đăng ký, tôn trọng đối thủ và tuân thủ quyết định của ban tổ chức.',
      status,
      visibility: index % 7 === 0 ? Visibility.PRIVATE : Visibility.PUBLIC,
      moderationStatus: [61, 72, 78].includes(ordinal)
        ? ModerationStatus.HIDDEN_BY_ADMIN
        : ModerationStatus.ACTIVE,
      isVerified: index % 3 !== 1,
      isOfficial: index % 4 === 0,
      mode,
      location: mode === TournamentMode.ONLINE ? null : region,
      maxTeams: Math.max(expectedApproved, approvedTeams + pendingTeams),
      maxTeamSize: gameCode === 'TEKKEN_8' ? 3 : 7,
      approvedTeams,
      pendingTeams,
      rejectedTeams,
      startDate: startDate.toISOString(),
      endDate: addDays(
        startDate,
        status === TournamentStatus.COMPLETED
          ? 4 + (index % 4)
          : 8 + (index % 7),
      ).toISOString(),
      registrationStartDate: addDays(
        startDate,
        -14 - (index % 7),
      ).toISOString(),
      registrationDeadline: addDays(startDate, -1).toISOString(),
      competition,
      partialMatchLimit: 2 + (index % 5),
      swissCompletedRounds: 1 + (index % 3),
      forceGrandFinalReset: index === 29 || index === 58,
      rounds: roundsFor(plan, index),
    };
  },
);
