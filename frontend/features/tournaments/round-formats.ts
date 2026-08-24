import type { TranslationKey } from "@/features/locale/store";

export const ROUND_FORMATS = [
  { value: "ROUND_ROBIN", labelKey: "round.format.ROUND_ROBIN" },
  { value: "GROUP_STAGE", labelKey: "round.format.GROUP_STAGE" },
  { value: "SWISS", labelKey: "round.format.SWISS" },
  { value: "PLAYOFF", labelKey: "round.format.PLAYOFF" },
  { value: "DOUBLE_ELIM", labelKey: "round.format.DOUBLE_ELIM" },
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: TranslationKey;
}>;

export type RoundFormatValue = (typeof ROUND_FORMATS)[number]["value"];

export function roundFormatLabel(
  format: string,
  translate: (key: TranslationKey) => string,
) {
  const item = ROUND_FORMATS.find((candidate) => candidate.value === format);
  return item ? translate(item.labelKey) : format;
}
