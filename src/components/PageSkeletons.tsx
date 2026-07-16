import { Skeleton } from "@/components/ui/skeleton";

function PageTitleSkeleton() {
  return <Skeleton className="h-7 w-40 rounded-full" />;
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-scroll">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-4 border-b border-border pb-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-[20px] flex-1 rounded-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-4">
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton key={col} className="h-[20px] flex-1 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <PageTitleSkeleton />
      </div>

      <div className="stat-cards">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="stat-card gap-2">
            <Skeleton className="h-[20px] w-[100px] rounded-full" />
            <Skeleton className="h-[20px] w-[60px] rounded-full" />
          </div>
        ))}
      </div>

      <section className="dashboard-section">
        <Skeleton className="h-[20px] w-[160px] rounded-full" />
        <div className="cross-table-scroll p-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, row) => (
              <div key={row} className="flex gap-2">
                {Array.from({ length: 6 }).map((_, col) => (
                  <Skeleton key={col} className="h-10 min-w-[72px] flex-1 rounded-md" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {[
        "Player Stats",
        "Best Hero by Player",
        "Best Teammate Pairing",
        "Hero Stats",
        "Recent Matches",
      ].map((section) => (
        <section key={section} className="dashboard-section">
          <Skeleton className="h-[20px] w-[140px] rounded-full" />
          <TableSkeleton rows={5} cols={5} />
        </section>
      ))}
    </div>
  );
}

export function PlayersPageSkeleton() {
  return (
    <div className="page">
      <div className="page-header row-header">
        <PageTitleSkeleton />
        <Skeleton className="h-9 w-[100px] rounded-md" />
      </div>

      <div className="inline-form">
        <Skeleton className="h-9 w-48 rounded-md" />
      </div>

      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}

export function MatchesPageSkeleton() {
  return (
    <div className="page">
      <div className="page-header row-header">
        <PageTitleSkeleton />
        <Skeleton className="h-9 w-[100px] rounded-md" />
      </div>

      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}
