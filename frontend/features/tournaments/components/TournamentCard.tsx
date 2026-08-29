import Link from "next/link";
import {
  CalendarBlankIcon,
  GameControllerIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Tournament } from "@/features/tournaments/types";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import type { TournamentView } from "@/features/tournaments/components/TournamentGrid";
import { accentVars } from "@/features/games/game-accent";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import ResolvedImage from "@/components/ResolvedImage";
import TournamentFavoriteButton from "@/features/tournaments/components/TournamentFavoriteButton";
import type { TournamentFavoriteMutationResult } from "@/features/tournaments/types";

const statusLabels: Record<Tournament["status"], TranslationKey> = {
  DRAFT: "tournaments.discovery.draft",
  REGISTRATION: "tournaments.discovery.registration",
  ONGOING: "tournaments.discovery.ongoing",
  COMPLETED: "tournaments.discovery.completed",
  CANCELLED: "tournaments.discovery.cancelled",
};

const statusClasses: Record<Tournament["status"], string> = {
  DRAFT: "tournament-status-DRAFT border-line bg-surface/85 text-ink-muted",
  REGISTRATION:
    "tournament-status-REGISTRATION border-approved/35 bg-approved/15 text-approved",
  ONGOING:
    "tournament-status-ONGOING border-brand/35 bg-brand/20 text-brand-hover",
  COMPLETED:
    "tournament-status-COMPLETED border-line-strong/50 bg-surface-sub/90 text-ink-muted",
  CANCELLED:
    "tournament-status-CANCELLED border-rejected/35 bg-rejected/15 text-rejected",
};

export default function TournamentCard({
  tournament: t,
  view = "grid",
  onFavoriteOptimisticChange,
  onFavoriteReconciled,
  onFavoriteRollback,
  showFavoriteFeedback = true,
}: {
  tournament: Tournament;
  view?: TournamentView;
  onFavoriteOptimisticChange?: (
    state: TournamentFavoriteMutationResult,
  ) => void;
  onFavoriteReconciled?: (state: TournamentFavoriteMutationResult) => void;
  onFavoriteRollback?: (state: TournamentFavoriteMutationResult) => void;
  showFavoriteFeedback?: boolean;
}) {
  const { locale, t: translate } = useLocale();
  const formattedDate = t.startDate
    ? formatLocalizedDate(t.startDate, locale)
    : translate("tournament.card.dateUnknown");
  const teamCount = t._count?.teams ?? 0;
  const registrationProgress = t.maxTeams
    ? Math.min(100, Math.round((teamCount / t.maxTeams) * 100))
    : 0;
  const listView = view === "list";

  return (
    <article
      style={accentVars(t.game?.name)}
      className={`tournament-card group relative overflow-hidden rounded-2xl border border-line bg-surface-card/90 transition duration-300 hover:-translate-y-1 hover:border-accent/55 hover:shadow-xl hover:shadow-accent/10 ${
        listView
          ? "grid sm:grid-cols-[18rem_minmax(0,1fr)]"
          : "flex h-full flex-col"
      }`}
    >
      <Link
        href={`/tournaments/${t.slug}`}
        aria-label={t.name}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-accent)]"
      />
      <div
        className={`tournament-card-media relative overflow-hidden ${listView ? "tournament-card-media-list h-44 sm:h-full sm:min-h-52" : "h-44"}`}
      >
        <ResolvedImage
          src={getTournamentBannerUrl(t.bannerUrl, t.game?.name, t.game?.code)}
          fallbackSrc={getTournamentBannerUrl(null, t.game?.name, t.game?.code)}
          alt=""
          className="absolute inset-0 size-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div
          aria-hidden
          className="tournament-card-media-gradient absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-black/10"
        />
        <span
          className={`tournament-status absolute left-4 top-4 rounded-md border px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur-md ${statusClasses[t.status]}`}
        >
          {translate(statusLabels[t.status])}
        </span>
        <TournamentFavoriteButton
          slug={t.slug}
          isFavorited={t.isFavorited}
          favoriteCount={t.favoriteCount}
          compact
          className="!absolute !right-4 !top-4 !bottom-auto !left-auto z-20"
          onOptimisticChange={onFavoriteOptimisticChange}
          onReconciled={onFavoriteReconciled}
          onRollback={onFavoriteRollback}
          showFeedback={showFavoriteFeedback}
        />

        <span className="absolute bottom-3 right-4 grid size-14 place-items-center overflow-hidden rounded-xl border border-white/15 bg-surface/90 text-accent shadow-lg shadow-black/30 backdrop-blur-md">
          <ResolvedImage
            src={t.game?.iconUrl}
            alt=""
            className="size-10 object-contain object-center"
            fallback={<GameControllerIcon size={28} weight="duotone" />}
          />
        </span>
      </div>

      <div
        className={`flex flex-1 flex-col ${listView ? "p-5 sm:p-6" : "p-5"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink transition group-hover:text-accent">
            {t.name}
          </h3>
          {t.game && (
            <span className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
              {t.displayGameName ?? t.game.name}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-ink-muted">
          {t.description || translate("tournament.card.noDescription")}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/70 pt-4 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <UsersThreeIcon size={16} weight="duotone" />
            {teamCount} {translate("tournament.card.teams")}
            {t.maxTeams ? ` / ${t.maxTeams}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlankIcon size={16} weight="duotone" />
            {formattedDate}
          </span>
        </div>

        {t.maxTeams && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-sub">
            <div
              aria-hidden
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-alt transition-[width] duration-500"
              style={{ width: `${registrationProgress}%` }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
