import { CardsSkeleton, Skeleton, TableSkeleton } from '@/components/ui/States';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <CardsSkeleton />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-4 w-32" />
            </div>
            <TableSkeleton rows={4} columns={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
