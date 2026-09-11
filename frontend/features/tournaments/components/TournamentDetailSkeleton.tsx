import { LoadingRegion, Skeleton } from "@/components/Loading";

export default function TournamentDetailSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion
      label={label}
      className="mx-auto w-full max-w-7xl flex-1 px-4 py-10"
    >
      <Skeleton className="aspect-[16/6] min-h-48 w-full rounded-none" />
      <Skeleton className="mt-6 h-9 w-3/4 max-w-xl" />
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {[0, 1].map((item) => (
          <div key={item} className="space-y-5 border border-line p-5">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
