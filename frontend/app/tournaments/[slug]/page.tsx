import type { Metadata } from "next";
import TournamentDetailClient from "@/features/tournaments/components/TournamentDetailClient";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import { getPublicTournament } from "@/features/tournaments/server";
import { resolveImageUrl } from "@/lib/image-url";
import { absoluteSiteUrl } from "@/lib/site-url";

interface TournamentPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

function safeReturnPath(value?: string | string[]) {
  if (typeof value !== "string") return "/tournaments";
  try {
    const base = "https://arenaverse.local";
    const url = new URL(value, base);
    if (
      url.origin !== base ||
      (url.pathname !== "/tournaments" && url.pathname !== "/ratings")
    ) {
      return "/tournaments";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/tournaments";
  }
}

function metadataDescription(name: string, description?: string | null) {
  const value = description?.trim() || `Thông tin và lịch thi đấu của ${name}.`;
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

export async function generateMetadata({
  params,
}: TournamentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  const canonical = absoluteSiteUrl(`/tournaments/${encodeURIComponent(slug)}`);

  if (!tournament) {
    return {
      title: "Không tìm thấy giải đấu | ArenaVerse",
      robots: { index: false, follow: false },
      alternates: { canonical },
    };
  }

  const description = metadataDescription(
    tournament.name,
    tournament.description,
  );
  const banner = getTournamentBannerUrl(
    tournament.bannerUrl,
    tournament.game.name,
    tournament.game.code,
  );
  const image = absoluteSiteUrl(resolveImageUrl(banner) || banner);

  return {
    title: `${tournament.name} | ArenaVerse`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "ArenaVerse",
      title: tournament.name,
      description,
      images: [{ url: image, alt: tournament.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: tournament.name,
      description,
      images: [image],
    },
  };
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: TournamentPageProps) {
  const [{ slug }, { returnTo }] = await Promise.all([params, searchParams]);
  const tournament = await getPublicTournament(slug);

  return (
    <TournamentDetailClient
      slug={slug}
      backHref={safeReturnPath(returnTo)}
      initialTournament={tournament}
    />
  );
}
