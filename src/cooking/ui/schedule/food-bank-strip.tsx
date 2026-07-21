import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '#/integrations/trpc/react'

/**
 * The compact "available portions" strip at the top of the Schedule. Shows
 * prepared portions grouped by Recipe (catalog) plus the commingled Ad-hoc
 * pool. Only entries with portions available are shown; hidden entirely when
 * the Food Bank is empty.
 */
export function FoodBankStrip() {
  const trpc = useTRPC()
  const query = useQuery(trpc.foodBank.summary.queryOptions())
  const entries = (query.data ?? []).filter((e) => e.available > 0)

  if (entries.length === 0) return null

  return (
    <section
      aria-label="Food Bank"
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Food Bank
      </span>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => (
          <span
            key={e.recipeId ?? '__adhoc__'}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {e.recipeName}
            <span className="tabular-nums">×{e.available}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
