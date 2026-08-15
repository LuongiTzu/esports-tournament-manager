export const ROUND_FORMATS = [
  { value: "ROUND_ROBIN", label: "Vòng tròn" },
  { value: "GROUP_STAGE", label: "Vòng bảng" },
  { value: "SWISS", label: "Hệ Thụy Sĩ" },
  { value: "PLAYOFF", label: "Playoff" },
  { value: "DOUBLE_ELIM", label: "Nhánh thắng - nhánh thua" },
] as const;

export const ROUND_FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  ROUND_FORMATS.map((format) => [format.value, format.label]),
);
