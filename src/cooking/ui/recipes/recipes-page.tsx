import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTRPC } from '#/integrations/trpc/react'
import { RecipeBadge } from './recipe-badge'
import { RecipeDetailSheet } from './recipe-detail-sheet'
import { RecipeFormSheet } from './recipe-form-sheet'
import type { RecipeWithAvailability } from '#/cooking/server/recipes/types'

export function RecipesPage() {
  const trpc = useTRPC()
  const listQuery = useQuery(trpc.recipes.list.queryOptions())

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<RecipeWithAvailability | null>(null)
  const [viewing, setViewing] = useState<RecipeWithAvailability | null>(null)

  const filtered = useMemo(() => {
    const recipes = listQuery.data ?? []
    const q = search.trim().toLowerCase()
    const list = q
      ? recipes.filter((r) => r.name.toLowerCase().includes(q))
      : recipes
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [listQuery.data, search])

  if (listQuery.isLoading) {
    return <LoadingState />
  }
  if (listQuery.error) {
    return (
      <ErrorState
        message={listQuery.error.message}
        onRetry={() => listQuery.refetch()}
      />
    )
  }

  const total = listQuery.data?.length ?? 0
  const formOpen = adding || editing !== null

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Recipes
          </h1>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'Your recipe catalog, with cookability at a glance.'
              : `${total} recipe${total === 1 ? '' : 's'} in your catalog.`}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="shrink-0">
          <Plus className="h-4 w-4" /> New
        </Button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes"
          className="pl-9"
        />
      </div>

      {total === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No recipes match “{search}”.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                onClick={() => setViewing(recipe)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {recipe.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {recipe.servings} serving{recipe.servings === 1 ? '' : 's'} ·{' '}
                    {recipe.ingredients.length} ingredient
                    {recipe.ingredients.length === 1 ? '' : 's'}
                  </div>
                </div>
                <RecipeBadge availability={recipe.availability} className="shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <RecipeFormSheet
        open={formOpen}
        recipe={editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false)
            setEditing(null)
          }
        }}
      />
      <RecipeDetailSheet
        recipe={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(r) => setEditing(r)}
      />
    </div>
  )
}

function LoadingState() {
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
      <p className="font-display text-lg">No recipes yet</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        Add a recipe with its ingredients and quantities. Each one gets a
        cookability badge against your inventory.
      </p>
      <Button onClick={onAdd} className="mt-4">
        <Plus className="h-4 w-4" /> Add a recipe
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
      <p className="font-display text-lg">Couldn't load your recipes</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {message}
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-4">
        Try again
      </Button>
    </div>
  )
}
