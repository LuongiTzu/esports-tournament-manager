import TournamentCard from "@/features/tournaments/components/TournamentCard";
import type { Tournament } from "@/features/tournaments/types";

export type TournamentView = "grid" | "list";

export function TournamentGrid({
  tournaments,
  view = "grid",
}: {
  tournaments: Tournament[];
  view?: TournamentView;
}) {
  return (
    <div
      className={
        view === "grid"
          ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-4"
      }
    >
      {tournaments.map((tournament) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          view={view}
        />
      ))}
    </div>
  );
}

export function TournamentGridSkeleton({
  count,
  view = "grid",
}: {
  count: number;
  view?: TournamentView;
}) {
  return (
    <div
      className={
        view === "grid"
          ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-4"
      }
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden
          className={`animate-pulse overflow-hidden rounded-2xl border border-line bg-surface-card ${
            view === "grid" ? "h-96" : "h-52 sm:h-48"
          }`}
        >
          <div className={view === "grid" ? "h-44 bg-surface-sub" : "h-full w-full bg-surface-sub sm:w-72"} />
          <div className="sr-only">
            <div className="h-5 w-2/3 rounded bg-surface-sub" />
          </div>
        </div>
      ))}
    </div>
  );
}
