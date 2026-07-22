import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTRPC } from '#/integrations/trpc/react'
import { EmptyState, ErrorState, LoadingState } from '../shared-states'
import { RecipeBadge } from './recipe-badge'
import { RecipeDetailSheet } from './recipe-detail-sheet'
import { RecipeFormSheet } from './recipe-form-sheet'
import type { RecipeWithAvailability } from '#/cooking/server/recipes/types'

export function RecipesPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const listQuery = useQuery(trpc.recipes.list.queryOptions())

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<RecipeWithAvailability | null>(null)
  const [viewing, setViewing] = useState<RecipeWithAvailability | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteMut = useMutation(
    trpc.recipes.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.recipes.list.queryKey() })
        setDeletingId(null)
      },
    }),
  )

  const filtered = useMemo(() => {
    const recipes = listQuery.data ?? []
    const q = search.trim().toLowerCase()
    // The repo already returns recipes ordered by name; filtering preserves it.
    return q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes
  }, [listQuery.data, search])

  if (listQuery.isLoading) {
    return <LoadingState />
  }
  if (listQuery.error) {
    return (
      <ErrorState
        title="Couldn't load your recipes"
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
        <EmptyState
          title="No recipes yet"
          body="Add a recipe with its ingredients and quantities. Each one gets a cookability badge against your inventory."
          actionLabel="Add a recipe"
          onAction={() => setAdding(true)}
        />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No recipes match “{search}”.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((recipe) => (
            <li key={recipe.id} className="rounded-lg border border-border bg-card">
              {deletingId === recipe.id ? (
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="flex-1 text-sm font-medium">Delete "{recipe.name}"?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate({ id: recipe.id })}
                  >
                    {deleteMut.isPending ? '…' : 'Delete'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteMut.isPending}
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setViewing(recipe)}
                    className="flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
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
                  <button
                    type="button"
                    onClick={() => setDeletingId(recipe.id)}
                    disabled={deleteMut.isPending}
                    className="shrink-0 px-3 py-3 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Delete ${recipe.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
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
