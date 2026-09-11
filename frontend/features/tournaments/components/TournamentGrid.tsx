import { Skeleton } from "@/components/Loading";
import TournamentCard from "@/features/tournaments/components/TournamentCard";
import type {
  Tournament,
  TournamentFavoriteMutationResult,
} from "@/features/tournaments/types";

export type TournamentView = "grid" | "list";

export function TournamentGrid({
  tournaments,
  view = "grid",
  onFavoriteOptimisticChange,
  onFavoriteReconciled,
  onFavoriteRollback,
  showFavoriteFeedback = true,
}: {
  tournaments: Tournament[];
  view?: TournamentView;
  onFavoriteOptimisticChange?: (
    tournament: Tournament,
    state: TournamentFavoriteMutationResult,
    index: number,
  ) => void;
  onFavoriteReconciled?: (
    tournament: Tournament,
    state: TournamentFavoriteMutationResult,
    index: number,
  ) => void;
  onFavoriteRollback?: (
    tournament: Tournament,
    state: TournamentFavoriteMutationResult,
    index: number,
  ) => void;
  showFavoriteFeedback?: boolean;
}) {
  return (
    <div
      className={
        view === "grid"
          ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-4"
      }
    >
      {tournaments.map((tournament, index) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          view={view}
          onFavoriteOptimisticChange={(state) =>
            onFavoriteOptimisticChange?.(tournament, state, index)
          }
          onFavoriteReconciled={(state) =>
            onFavoriteReconciled?.(tournament, state, index)
          }
          onFavoriteRollback={(state) =>
            onFavoriteRollback?.(tournament, state, index)
          }
          showFavoriteFeedback={showFavoriteFeedback}
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
          className={`overflow-hidden rounded-2xl border border-line bg-surface-card ${
            view === "grid" ? "min-h-96" : "min-h-52 sm:flex sm:min-h-48"
          }`}
        >
          <Skeleton
            className={
              view === "grid"
                ? "h-44 rounded-none"
                : "h-28 rounded-none sm:h-auto sm:w-72 sm:shrink-0"
            }
          />
          <div className="flex-1 space-y-4 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
