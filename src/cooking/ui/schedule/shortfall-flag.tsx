import { AlertTriangle } from 'lucide-react'
import { cn } from '#/lib/utils'

/**
 * The soft, non-blocking shortfall flag shown on a scheduled slot whose recipe
 * (or ad-hoc) has ingredients not currently available. Just a count — cooking
 * is never blocked (CONTEXT.md → Cook / Shopping List).
 */
export function ShortfallFlag({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-accent-warm/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-accent-warm-foreground',
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {count}
    </span>
  )
}
