export const publicTournamentSections = [
  "overview",
  "competition",
  "participants",
  "ratings",
] as const;

export type PublicTournamentSection = (typeof publicTournamentSections)[number];

export function isPublicTournamentSection(
  value: string,
): value is PublicTournamentSection {
  return publicTournamentSections.some((section) => section === value);
}

export function publicTournamentSectionHref(
  slug: string,
  section: PublicTournamentSection,
) {
  const base = `/tournaments/${encodeURIComponent(slug)}`;
  return section === "overview" ? base : `${base}/${section}`;
}
