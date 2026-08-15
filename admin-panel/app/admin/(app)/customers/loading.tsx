import { Skeleton, TableSkeleton } from '@/components/ui/States';

export default function CustomersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="card overflow-hidden">
        <TableSkeleton rows={8} columns={6} />
      </div>
    </div>
  );
}
