import { RoundFormat } from '@prisma/client';

/**
 * Cấu hình (settings) cho từng thể thức thi đấu.
 *
 * Mỗi format có một schema riêng — được lưu dưới dạng JSON trong `Round.settings`.
 * Các interface dưới đây là "contract" cho từng thể thức, giúp:
 *  - Validate DTO theo từng format (tách riêng trong `src/brackets/dto/`)
 *  - Các generator (GĐ 5.2+) đọc settings một cách an toàn, có type rõ ràng
 *  - FE render form cấu hình vòng đấu một cách động theo format
 *
 * Nguyên tắc clean architecture: tầng domain (types) không phụ thuộc tầng infra.
 * Do đó file này không import Prisma enum trực tiếp — chỉ dùng literal string tương ứng.
 */

/** Tiêu chí tiebreak (thứ tự ưu tiên từ trái sang phải) */
export type SwissTiebreaker = 'BUCHHOLZ' | 'HEAD_TO_HEAD' | 'SCORE_DIFF';

/** Cách xếp hạt giống (seeding) khi sinh bracket */
export type SeedingStrategy = 'STANDARD';

/**
 * Vòng tròn tính điểm (ROUND_ROBIN)
 * VD: mỗi đội gặp mọi đội khác đúng 1 lượt, tính điểm 3-1-0.
 */
export interface RoundRobinSettings {
  /** Đá 2 lượt (lượt đi + lượt về, đảo sân) */
  doubleRound: boolean;
  /** Điểm thắng */
  pointsWin: number;
  /** Điểm hòa */
  pointsDraw: number;
  /** Điểm thua */
  pointsLoss: number;
}

/**
 * Vòng bảng (GROUP_STAGE)
 * Chia `numGroups` bảng, mỗi bảng `teamsPerGroup` đội, đứng đầu đi tiếp.
 */
export interface GroupStageSettings {
  /** Số bảng đấu */
  numGroups: number;
  /** Số đội mỗi bảng */
  teamsPerGroup: number;
  /** Số đội đứng đầu mỗi bảng đi tiếp */
  advanceCount: number;
  /** Đá 2 lượt trong bảng */
  doubleRound: boolean;
  /** Điểm thắng/hòa/thua trong từng bảng */
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
}

/**
 * Thụy Sĩ (SWISS)
 * Không sinh hết bracket một lần — mỗi vòng sinh sau khi vòng trước kết thúc.
 */
export interface SwissSettings {
  /** Tổng số vòng đấu — mặc định tính = ceil(log2(numTeams)) */
  numRounds: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  /** Thứ tự tiebreak ưu tiên */
  tiebreakers: SwissTiebreaker[];
  /** Số đội đứng đầu đi tiếp */
  advanceCount: number;
}

/** Playoff — Single Elimination (PLAYOFF) */
export interface PlayoffSettings {
  /** Cách xếp hạt giống */
  seeding: SeedingStrategy;
  /** Có trận tranh hạng 3 hay không */
  thirdPlaceMatch: boolean;
}

/** Nhánh thắng - thua — Double Elimination (DOUBLE_ELIM) */
export interface DoubleElimSettings {
  seeding: SeedingStrategy;
  /** Có Grand Final Reset (nếu đội nhánh thua thắng ván 1) */
  grandFinalReset: boolean;
}

/**
 * Union của toàn bộ settings theo format.
 * Dùng để map format → interface tương ứng.
 */
export type RoundSettingsMap = {
  [RoundFormat.ROUND_ROBIN]: RoundRobinSettings;
  [RoundFormat.GROUP_STAGE]: GroupStageSettings;
  [RoundFormat.SWISS]: SwissSettings;
  [RoundFormat.PLAYOFF]: PlayoffSettings;
  [RoundFormat.DOUBLE_ELIM]: DoubleElimSettings;
};

/** Loại settings của một format cụ thể */
export type RoundSettingsFor<F extends RoundFormat> = RoundSettingsMap[F];

/**
 * Giá trị mặc định cho từng format.
 * Dùng khi FE không gửi `settings` — service tự điền để đảm bảo luôn có settings hợp lệ.
 */
export const DEFAULT_ROUND_SETTINGS: RoundSettingsMap = {
  [RoundFormat.ROUND_ROBIN]: {
    doubleRound: false,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
  },
  [RoundFormat.GROUP_STAGE]: {
    numGroups: 4,
    teamsPerGroup: 4,
    advanceCount: 2,
    doubleRound: false,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
  },
  [RoundFormat.SWISS]: {
    numRounds: 5,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    tiebreakers: ['BUCHHOLZ', 'HEAD_TO_HEAD', 'SCORE_DIFF'],
    advanceCount: 8,
  },
  [RoundFormat.PLAYOFF]: {
    seeding: 'STANDARD',
    thirdPlaceMatch: true,
  },
  [RoundFormat.DOUBLE_ELIM]: {
    seeding: 'STANDARD',
    grandFinalReset: true,
  },
};
