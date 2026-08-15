import { Skeleton, TableSkeleton } from '@/components/ui/States';

export default function PaymentsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="card overflow-hidden">
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}
