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

/** Cách xếp hạt giống (seeding) khi sinh bracket */

/**
 * Vòng tròn tính điểm (ROUND_ROBIN)
 * VD: mỗi đội gặp mọi đội khác đúng 1 lượt, tính điểm 3-1-0.
 */
export interface RoundRobinSettings {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  allowDraws: boolean;
  /** Số lần mỗi cặp đội gặp nhau. */
  meetingsPerPair: number;
}

/**
 * Vòng bảng (GROUP_STAGE)
 * Chia đội thực tế thành các bảng bằng nhau; số đội mỗi bảng luôn được suy ra.
 */
export interface GroupStageSettings {
  /** Số bảng đấu */
  numberOfGroups: number;
  /** Số đội mỗi bảng */
  advancingTeamsPerGroup: number;
  /** Số đội đứng đầu mỗi bảng đi tiếp */
  winPoints: number;
  /** Đá 2 lượt trong bảng */
  drawPoints: number;
  /** Điểm thắng/hòa/thua trong từng bảng */
  lossPoints: number;
  allowDraws: boolean;
  meetingsPerPair: number;
}

/**
 * Thụy Sĩ (SWISS)
 * Không sinh hết bracket một lần — mỗi vòng sinh sau khi vòng trước kết thúc.
 */
export interface SwissSettings {
  /** Null means derive ceil(log2(actual participating teams)) at generation. */
  numberOfRounds: number | null;
  /** Number of highest-ranked teams passed to the next Tournament Round. */
  advancingTeamCount: number;
}

/** Playoff — Single Elimination (PLAYOFF) */
export interface PlayoffSettings {
  /** Có trận tranh hạng 3 hay không */
  thirdPlaceMatch: boolean;
}

/** Nhánh thắng - thua — Double Elimination (DOUBLE_ELIM) */
export interface DoubleElimSettings {
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
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    allowDraws: false,
    meetingsPerPair: 1,
  },
  [RoundFormat.GROUP_STAGE]: {
    numberOfGroups: 2,
    advancingTeamsPerGroup: 2,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    allowDraws: false,
    meetingsPerPair: 1,
  },
  [RoundFormat.SWISS]: {
    numberOfRounds: null,
    advancingTeamCount: 8,
  },
  [RoundFormat.PLAYOFF]: {
    thirdPlaceMatch: true,
  },
  [RoundFormat.DOUBLE_ELIM]: {
    grandFinalReset: true,
  },
};

export function resolveSwissNumberOfRounds(
  teamCount: number,
  configuredNumberOfRounds: number | null,
): number {
  return configuredNumberOfRounds ?? Math.ceil(Math.log2(teamCount));
}
