import TournamentCard from "@/features/tournaments/components/TournamentCard";
import type { Tournament } from "@/features/tournaments/types";

export function TournamentGrid({ tournaments }: { tournaments: Tournament[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
}

export function TournamentGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden
          className="h-44 animate-pulse rounded-xl border border-line bg-surface-card p-5"
        >
          <div className="h-5 w-2/3 rounded bg-surface-sub" />
          <div className="mt-4 h-4 rounded bg-surface-sub" />
          <div className="mt-2 h-4 w-4/5 rounded bg-surface-sub" />
        </div>
      ))}
    </div>
  );
}
