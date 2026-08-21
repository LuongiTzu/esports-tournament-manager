export const ROUND_FORMATS = [
  { value: "ROUND_ROBIN", label: "Vòng tròn" },
  { value: "GROUP_STAGE", label: "Vòng bảng" },
  { value: "SWISS", label: "Hệ Thụy Sĩ" },
  { value: "PLAYOFF", label: "Loại trực tiếp" },
  { value: "DOUBLE_ELIM", label: "Nhánh thắng - nhánh thua" },
] as const;

export type RoundFormatValue = (typeof ROUND_FORMATS)[number]["value"];

export const ROUND_FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  ROUND_FORMATS.map((format) => [format.value, format.label]),
);
