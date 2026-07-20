import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTRPC } from '#/integrations/trpc/react'
import { AddIngredientSheet } from './add-ingredient-sheet'
import { EditIngredientSheet } from './edit-ingredient-sheet'
import { StateMarker } from './state-marker'
import { formatQuantity } from './format'
import type { InventoryItem, InventoryState } from '#/cooking/server/inventory/types'

const SECTION_ORDER: InventoryState[] = ['tracked', 'endless', 'unavailable']
const SECTION_LABEL: Record<InventoryState, string> = {
  tracked: 'Tracked',
  endless: 'Endless',
  unavailable: 'Out',
}

export function InventoryPage() {
  const trpc = useTRPC()
  const listQuery = useQuery(trpc.inventory.list.queryOptions())

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)

  const sections = useMemo(() => {
    const items = listQuery.data ?? []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? items.filter((i) => i.ingredient.name.toLowerCase().includes(q))
      : items
    const byName = (a: InventoryItem, b: InventoryItem) =>
      a.ingredient.name.localeCompare(b.ingredient.name)
    return SECTION_ORDER.map((state) => ({
      state,
      items: filtered.filter((i) => i.state === state).sort(byName),
    })).filter((s) => s.items.length > 0)
  }, [listQuery.data, search])

  if (listQuery.isLoading) {
    return <LoadingPantry />
  }

  if (listQuery.error) {
    return (
      <ErrorState
        message={listQuery.error.message}
        onRetry={() => listQuery.refetch()}
      />
    )
  }

  const totalItems = listQuery.data?.length ?? 0

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalItems === 0
              ? 'Your kitchen, tracked your way.'
              : `${totalItems} ingredient${totalItems === 1 ? '' : 's'} in your kitchen.`}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="shrink-0">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredients"
          className="pl-9"
        />
      </div>

      {totalItems === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : sections.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No ingredients match “{search}”.
        </p>
      ) : (
        <div className="space-y-8">
          {sections.map(({ state, items }) => (
            <section key={state}>
              <div className="flex items-center gap-2 pb-2">
                <StateMarker state={state} />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {SECTION_LABEL[state]}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {items.map((item) => (
                  <li key={item.ingredient.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <StateMarker state={item.state} />
                      <span className="flex-1 truncate text-sm font-medium">
                        {item.ingredient.name}
                      </span>
                      <Quantity item={item} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AddIngredientSheet open={adding} onOpenChange={setAdding} />
      <EditIngredientSheet item={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  )
}

function Quantity({ item }: { item: InventoryItem }) {
  if (item.state === 'endless') {
    return <span className="text-xs text-muted-foreground">staple</span>
  }
  if (item.state === 'unavailable') {
    return <span className="text-xs text-muted-foreground">out</span>
  }
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {formatQuantity(item.quantity)} {item.ingredient.unit}
    </span>
  )
}

function LoadingPantry() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-32 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg">Your pantry's empty</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        Add your first ingredient to start tracking what's in your kitchen — by
        count, as a staple, or marked out.
      </p>
      <Button onClick={onAdd} className="mt-4">
        <Plus className="h-4 w-4" /> Add an ingredient
      </Button>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg">Couldn't load your inventory</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {message}
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-4">
        Try again
      </Button>
    </div>
  )
}
