import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />;
}

/** Placeholder that keeps the panel's shape while its data loads. */
export function SkeletonPanel({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('glass p-5', className)}>
      <Skeleton className="h-3 w-20" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}
