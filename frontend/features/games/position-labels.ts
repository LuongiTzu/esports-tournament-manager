export type GamePositionLocale = "vi" | "en";

interface GamePositionLabels {
  vi: string;
  en: string;
}

const POSITION_LABELS: Record<string, GamePositionLabels> = {
  TOP: { vi: "Đường trên", en: "Top" },
  JUNGLE: { vi: "Đi rừng", en: "Jungle" },
  MID: { vi: "Đường giữa", en: "Mid" },
  BOT: { vi: "Xạ thủ / Đường dưới", en: "Bot / ADC" },
  SUPPORT: { vi: "Hỗ trợ", en: "Support" },
  DARK_SLAYER_LANE: {
    vi: "Đường Tà Thần / Caesar",
    en: "Dark Slayer Lane",
  },
  DRAGON_LANE: { vi: "Đường Rồng", en: "Dragon Lane" },
  ROAM: { vi: "Trợ thủ", en: "Roam / Support" },
  DUELIST: { vi: "Đối đầu", en: "Duelist" },
  INITIATOR: { vi: "Khởi tranh", en: "Initiator" },
  CONTROLLER: { vi: "Kiểm soát", en: "Controller" },
  SENTINEL: { vi: "Hộ vệ", en: "Sentinel" },
  POSITION_1: { vi: "Vị trí 1 / Carry", en: "Position 1 / Carry" },
  POSITION_2: { vi: "Vị trí 2 / Đường giữa", en: "Position 2 / Mid" },
  POSITION_3: { vi: "Vị trí 3 / Offlane", en: "Position 3 / Offlane" },
  POSITION_4: {
    vi: "Vị trí 4 / Hỗ trợ linh hoạt",
    en: "Position 4 / Soft Support",
  },
  POSITION_5: {
    vi: "Vị trí 5 / Hỗ trợ chính",
    en: "Position 5 / Hard Support",
  },
};

export function gamePositionLabel(
  code: string,
  locale: GamePositionLocale = "vi",
) {
  return POSITION_LABELS[code]?.[locale] ?? code;
}
