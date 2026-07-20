import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '#/lib/utils'
import type { Availability } from '#/cooking/server/recipes/types'

/**
 * The cookability badge: a sage "Cookable" pill when every required ingredient
 * is available, a saffron "Missing N" pill otherwise. Reused by the list, the
 * detail view, and (later) the Schedule.
 */
export function RecipeBadge({
  availability,
  className,
}: {
  availability: Availability
  className?: string
}) {
  if (availability.ok) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
          className,
        )}
      >
        <Check className="h-3.5 w-3.5" aria-hidden /> Cookable
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-accent-warm/15 px-2 py-0.5 text-xs font-medium text-accent-warm-foreground',
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Missing {availability.missingCount}
    </span>
  )
}
