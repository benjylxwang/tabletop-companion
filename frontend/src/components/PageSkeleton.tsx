import { Skeleton } from './ui/Skeleton';

export function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
