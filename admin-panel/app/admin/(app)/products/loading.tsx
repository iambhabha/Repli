import { Skeleton, TableSkeleton } from '@/components/ui/States';

export default function ProductsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-9 w-full max-w-sm" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="card overflow-hidden">
          <TableSkeleton rows={3} columns={5} />
        </div>
      ))}
    </div>
  );
}
