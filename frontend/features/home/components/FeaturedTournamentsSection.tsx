"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import ScrollReveal from "@/features/home/components/ScrollReveal";
import SectionHeading from "@/features/home/components/SectionHeading";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  TournamentGrid,
  TournamentGridSkeleton,
} from "@/features/tournaments/components/TournamentGrid";
import type { Tournament } from "@/features/tournaments/types";

const FEATURED_LIMIT = 3;

export default function FeaturedTournamentsSection() {
  const { t } = useLocale();
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<{
    retryCount: number;
    tournaments: Tournament[];
    error: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .findAll({ limit: FEATURED_LIMIT })
      .then((response) => {
        if (!cancelled) {
          setResult({ retryCount, tournaments: response.data, error: "" });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            retryCount,
            tournaments: [],
            error:
              error instanceof Error
                ? error.message
                : t("home.featured.loadError"),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount, t]);

  const loading = result?.retryCount !== retryCount;
  const tournaments = result?.tournaments ?? [];
  const error = result?.error ?? "";

  return (
    <section
      id="featured-tournaments"
      className="relative scroll-mt-24 overflow-hidden border-b border-line bg-surface-card/25 py-20 sm:py-24"
    >
      <div
        aria-hidden
        className="absolute -right-48 top-12 -z-10 size-96 rounded-full bg-brand-secondary/8 blur-3xl"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow={t("home.featured.eyebrow")}
            title={t("home.featured.title")}
            description={t("home.featured.description")}
          />
        </ScrollReveal>

        <div className="mt-10" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <>
              <TournamentGridSkeleton count={FEATURED_LIMIT} />
              <span className="sr-only">{t("home.featured.loading")}</span>
            </>
          ) : error ? (
            <div className="rounded-2xl border border-rejected/40 bg-rejected/10 px-6 py-10 text-center">
              <p className="font-medium text-rejected">{error}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-4 rounded-lg border border-rejected/40 px-4 py-2 text-sm font-semibold text-rejected transition hover:bg-rejected/10"
              >
                {t("home.featured.retry")}
              </button>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
              <p className="font-semibold text-ink">{t("home.featured.empty")}</p>
              <p className="mt-2 text-sm text-ink-muted">
                {t("home.featured.emptyHelp")}
              </p>
            </div>
          ) : (
            <TournamentGrid tournaments={tournaments} />
          )}
        </div>

        <div className="mt-9 flex justify-center">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 rounded-lg border border-brand/35 bg-brand/10 px-5 py-2.5 text-sm font-semibold text-brand-hover transition hover:border-brand/60 hover:bg-brand/15 hover:shadow-glow-brand"
          >
            {t("home.featured.viewAll")}
            <ArrowRightIcon aria-hidden size={17} weight="bold" />
          </Link>
        </div>
      </div>
    </section>
  );
}
