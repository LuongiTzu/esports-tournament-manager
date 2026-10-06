import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TournamentDetailClient from "@/features/tournaments/components/TournamentDetailClient";
import { getPublicTournament } from "@/features/tournaments/server";
import {
  isPublicTournamentSection,
  publicTournamentSectionHref,
} from "@/features/tournaments/public-sections";

interface SectionPageProps {
  params: Promise<{ slug: string; section: string }>;
}

export async function generateMetadata({
  params,
}: SectionPageProps): Promise<Metadata> {
  const { slug, section } = await params;
  if (!isPublicTournamentSection(section) || section === "overview") {
    return { robots: { index: false, follow: false } };
  }
  const tournament = await getPublicTournament(slug);
  return {
    title: tournament ? `${tournament.name} | ArenaVerse` : "ArenaVerse",
    alternates: { canonical: publicTournamentSectionHref(slug, section) },
  };
}

export default async function TournamentSectionPage({ params }: SectionPageProps) {
  const { slug, section } = await params;
  const legacySection =
    section === "comments" || section === "rules" ? section : undefined;
  const selectedSection = isPublicTournamentSection(section)
    ? section
    : legacySection
      ? "overview"
      : notFound();
  if (selectedSection === "overview" && !legacySection) notFound();

  const tournament = await getPublicTournament(slug);
  return (
    <TournamentDetailClient
      slug={slug}
      section={selectedSection}
      legacySection={legacySection}
      backHref="/tournaments"
      initialTournament={tournament}
    />
  );
}
