import { Skeleton } from '@/components/ui/States';

export default function MessagesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />
      <div className="card flex h-[calc(100vh-11rem)] min-h-[30rem] overflow-hidden">
        <div className="w-full space-y-3 border-r border-border p-3 lg:w-80">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex gap-3 py-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden flex-1 bg-chat-bg lg:block" />
      </div>
    </div>
  );
}
