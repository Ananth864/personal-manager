import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useTRPC } from '#/integrations/trpc/react'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { Button } from '#/components/ui/button'

/**
 * The compact "available portions" strip at the top of the Schedule. Shows
 * prepared portions grouped by Recipe (catalog) plus the commingled Ad-hoc
 * pool. Only entries with portions available are shown; hidden entirely when
 * the Food Bank is empty.
 *
 * Each pill opens a discard control so portions can be reduced directly (thrown
 * away / eaten without a slot) without planning a meal around them.
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
          <DiscardPill
            key={e.recipeId ?? '__adhoc__'}
            recipeId={e.recipeId}
            name={e.recipeName}
            available={e.available}
            discardable={e.discardable}
          />
        ))}
      </div>
    </section>
  )
}

function DiscardPill({
  recipeId,
  name,
  available,
  discardable,
}: {
  recipeId: string | null
  name: string
  available: number
  discardable: number
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [count, setCount] = useState(1)
  const [open, setOpen] = useState(false)

  const discardMut = useMutation(
    trpc.foodBank.discard.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.foodBank.summary.queryKey() })
        setOpen(false)
        setCount(1)
      },
    }),
  )

  // Nothing real to discard (only projected/planned portions exist, or all are
  // reserved). Still show the pill as a readout, but disable the action.
  const noneToDiscard = discardable <= 0

  return (
    <Popover open={open} onOpenChange={(o: boolean) => { setOpen(o); if (o) setCount(1) }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {name}
          <span className="tabular-nums">×{available}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="mb-1 text-sm font-semibold">{name}</div>
        {noneToDiscard ? (
          <p className="text-xs text-muted-foreground">
            {available} available in the Food Bank
            {available > 0
              ? ' — all are projected from upcoming cooks or reserved by meal slots, so none can be discarded yet.'
              : '.'}
          </p>
        ) : (
          <>
            <div className="mb-3 text-xs text-muted-foreground">
              {discardable} real portion{discardable === 1 ? '' : 's'} can be discarded
              {available > discardable ? ` (${available} shown includes planned)` : ''}.
            </div>
            <div className="mb-3 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                disabled={count <= 1}
                aria-label="Fewer portions"
              >
                <MinusIcon className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">{count}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCount((c) => Math.min(discardable, c + 1))}
                disabled={count >= discardable}
                aria-label="More portions"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => discardMut.mutate({ recipeId, count })}
              disabled={discardMut.isPending}
            >
              Discard {count}
            </Button>
            {discardMut.isError ? (
              <p className="mt-2 text-xs text-destructive">
                {discardMut.error.message}
              </p>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
