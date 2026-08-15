import { Skeleton, TableSkeleton } from '@/components/ui/States';

export default function OrdersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="card overflow-hidden">
        <TableSkeleton rows={8} columns={7} />
      </div>
    </div>
  );
}
