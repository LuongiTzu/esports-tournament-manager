import Link from "next/link";
import { UsersThreeIcon, CalendarBlankIcon } from "@phosphor-icons/react";
import type { Tournament } from "@/features/tournaments/types";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import { accentVars } from "@/features/games/game-accent";
import { useLocale } from "@/features/locale/store";

export default function TournamentCard({
  tournament: t,
}: {
  tournament: Tournament;
}) {
  const { locale, t: translate } = useLocale();
  const formattedDate = t.startDate
    ? new Date(t.startDate).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")
    : translate("tournament.card.dateUnknown");

  return (
    <Link
      href={`/tournaments/${t.slug}`}
      style={accentVars(t.game?.name)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line border-l-2 border-l-accent bg-surface-card transition duration-300 hover:-translate-y-0.5 hover:border-brand/45 hover:border-l-accent hover:shadow-lg hover:shadow-brand/10"
    >
      <div
        aria-hidden
        className="h-32 bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ backgroundImage: `url(${JSON.stringify(getTournamentBannerUrl(t.bannerUrl))})` }}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-ink transition group-hover:text-accent">
            {t.name}
          </h3>
          {t.game && (
            <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">
              {t.game.name}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 flex-1 text-sm text-ink-muted">
          {t.description || translate("tournament.card.noDescription")}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <UsersThreeIcon size={14} />
            {t._count?.teams ?? 0} {translate("tournament.card.teams")}
            {t.maxTeams ? ` / ${t.maxTeams}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlankIcon size={14} />
            {formattedDate}
          </span>
        </div>
      </div>
    </Link>
  );
}
