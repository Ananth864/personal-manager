import { Circle, CircleDot, CircleSlash } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { InventoryState } from '#/cooking/server/inventory/types'
import { cn } from '#/lib/utils'

/**
 * The signature element of the Inventory surface: a small glyph encoding the
 * Endless / Tracked / Unavailable state at a glance.
 *   Tracked     → CircleDot   (a quantified amount you have)
 *   Endless     → Circle      (a staple, unquantified)
 *   Unavailable → CircleSlash (out)
 */
const CONFIG: Record<InventoryState, { icon: LucideIcon; tone: string }> = {
  tracked: { icon: CircleDot, tone: 'text-primary' },
  endless: { icon: Circle, tone: 'text-primary' },
  unavailable: { icon: CircleSlash, tone: 'text-muted-foreground' },
}

export function StateMarker({
  state,
  className,
}: {
  state: InventoryState
  className?: string
}) {
  const { icon: Icon, tone } = CONFIG[state]
  return <Icon className={cn('h-4 w-4 shrink-0', tone, className)} aria-hidden />
}
