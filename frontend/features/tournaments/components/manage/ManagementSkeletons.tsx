import { LoadingRegion, Skeleton } from "@/components/Loading";

export function ManagementPageSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion
      label={label}
      className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
    >
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-5 h-9 w-3/4 max-w-xl" />
      <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-line p-5">
        <div className="w-2/3 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="mt-6 rounded-2xl border border-line p-5">
        <Skeleton className="h-6 w-52" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="space-y-4 rounded-xl border border-line p-4"
            >
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-line p-5">
        <Skeleton className="mb-6 h-6 w-48" />
        <CompetitionSkeleton label={label} />
      </div>
    </LoadingRegion>
  );
}

export function MatchSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="space-y-4 p-4 sm:p-6">
      <div className="rounded-xl border border-line p-5">
        <div className="grid grid-cols-3 items-center gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex flex-col items-center gap-3">
              <Skeleton className={item === 1 ? "h-9 w-20" : "size-12"} />
              <Skeleton className="h-4 w-3/4 max-w-36" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="mx-auto mt-6 h-4 w-2/3" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="space-y-5 rounded-xl border border-line p-5"
          >
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mt-8 h-12 w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function CompetitionSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`space-y-4 ${item === 2 ? "hidden lg:block" : ""}`}
          >
            <Skeleton className="h-4 w-28" />
            {[0, 1].map((match) => (
              <div
                key={match}
                className="space-y-3 rounded-xl border border-line p-4"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
