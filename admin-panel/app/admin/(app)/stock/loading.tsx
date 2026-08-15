import { Skeleton, TableSkeleton } from '@/components/ui/States';

export default function StockLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="card overflow-hidden">
        <TableSkeleton rows={10} columns={6} />
      </div>
    </div>
  );
}
