import type { MetadataRoute } from "next";
import { getPublicTournamentSitemapPage } from "@/features/tournaments/server";
import { absoluteSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteSiteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteSiteUrl("/tournaments"),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: absoluteSiteUrl("/terms"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absoluteSiteUrl("/privacy"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  try {
    const firstPage = await getPublicTournamentSitemapPage(1);
    const remainingPages = await Promise.all(
      Array.from(
        { length: Math.max(0, firstPage.pagination.totalPages - 1) },
        (_, index) => getPublicTournamentSitemapPage(index + 2),
      ),
    );
    const pages = [firstPage, ...remainingPages];

    return [
      ...staticRoutes,
      ...pages.flatMap((result) =>
        result.data.map((tournament) => ({
          url: absoluteSiteUrl(
            `/tournaments/${encodeURIComponent(tournament.slug)}`,
          ),
          lastModified: new Date(tournament.createdAt),
          changeFrequency: "daily" as const,
          priority: tournament.status === "ONGOING" ? 0.9 : 0.7,
        })),
      ),
    ];
  } catch {
    return staticRoutes;
  }
}
