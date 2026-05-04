// Lightweight skeleton primitives for QBuild loading states.
// Pure CSS shimmer (no JS animation) so it stays cheap on mobile.

export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded-md bg-white/[0.06] ${className}`}
      style={{
        width: width ?? "100%",
        height: height ?? "1em",
      }}
    />
  );
}

export function VacancySkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton width="60%" height={16} />
          <Skeleton width="35%" height={11} />
        </div>
        <Skeleton width={70} height={20} />
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton width="100%" height={11} />
        <Skeleton width="85%" height={11} />
      </div>
      <div className="mt-3 flex justify-between">
        <Skeleton width={70} height={11} />
        <Skeleton width={90} height={11} />
      </div>
    </div>
  );
}

export function VacancyListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading vacancies">
      {Array.from({ length: count }).map((_, i) => (
        <VacancySkeleton key={i} />
      ))}
    </div>
  );
}

export function VacancyDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton width={160} height={11} />
        <Skeleton width="70%" height={28} />
        <div className="flex gap-3">
          <Skeleton width={90} height={11} />
          <Skeleton width={70} height={11} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <Skeleton width={140} height={11} />
          <Skeleton width="100%" height={11} />
          <Skeleton width="95%" height={11} />
          <Skeleton width="98%" height={11} />
          <Skeleton width="40%" height={11} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width={60} height={18} className="rounded-full" />
            ))}
          </div>
        </div>
        <aside className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <Skeleton width={120} height={11} />
          <Skeleton width="100%" height={56} />
          <Skeleton width="100%" height={36} />
        </aside>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton width={48} height={48} className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton width="40%" height={16} />
          <Skeleton width="25%" height={11} />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width="20%" height={11} />
          <Skeleton width="100%" height={36} />
        </div>
      ))}
    </div>
  );
}
