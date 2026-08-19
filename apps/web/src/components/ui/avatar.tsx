import { cn, initials } from '@/lib/utils';

const SIZES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-14 w-14 text-lg',
} as const;

/** Emoji avatars render as-is; anything else falls back to initials. */
export function Avatar({
  name,
  avatar,
  size = 'md',
  className,
}: {
  name: string;
  avatar?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const isEmoji = Boolean(avatar) && !avatar!.startsWith('http') && avatar!.length <= 4;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-line-strong',
        'bg-gradient-to-br from-violet/40 to-violet-dim font-semibold text-paper',
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {isEmoji ? avatar : initials(name)}
    </span>
  );
}
