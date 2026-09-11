import { LoadingRegion, Skeleton } from "@/components/Loading";

export function TeamDetailSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion
      label={label}
      className="rounded-2xl border border-line bg-surface-card p-5"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-12" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="mt-6 h-4 w-32" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-xl border border-line p-3"
          >
            <Skeleton className="size-9" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function RegistrationSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.35fr)]">
      <LoadingRegion label={label}>
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="space-y-3 rounded-xl border border-line p-5"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </LoadingRegion>
      <TeamDetailSkeleton label={label} />
    </div>
  );
}
