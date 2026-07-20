import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useTRPC } from '#/integrations/trpc/react'
import { RecipeBadge } from './recipe-badge'
import { formatQuantity } from '../inventory/format'
import type { RecipeWithAvailability } from '#/cooking/server/recipes/types'

export function RecipeDetailSheet({
  recipe,
  onOpenChange,
  onEdit,
}: {
  recipe: RecipeWithAvailability | null
  onOpenChange: (open: boolean) => void
  onEdit: (recipe: RecipeWithAvailability) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const deleteMutation = useMutation(
    trpc.recipes.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.recipes.list.queryKey() })
        setConfirmingDelete(false)
        onOpenChange(false)
      },
    }),
  )

  const open = recipe !== null

  function handleEdit() {
    if (!recipe) return
    onOpenChange(false)
    onEdit(recipe)
  }

  return (
    <Sheet open={open} onOpenChange={(o: boolean) => { if (!o) setConfirmingDelete(false); onOpenChange(o) }}>
      <SheetContent className="flex flex-col gap-6">
        {recipe && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">{recipe.name}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <RecipeBadge availability={recipe.availability} />
                <span>·</span>
                <span>
                  {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
                </span>
                <span>·</span>
                <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  What you need
                </h3>
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {recipe.ingredients.map(({ ingredient, quantity }) => (
                    <li
                      key={ingredient.id}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="text-sm font-medium">{ingredient.name}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatQuantity(quantity)} {ingredient.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {recipe.notes && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {recipe.notes}
                  </p>
                </section>
              )}

              {deleteMutation.error && (
                <p className="text-sm text-destructive" role="alert">
                  {deleteMutation.error.message}
                </p>
              )}
            </div>

            <SheetFooter className="sm:flex-col gap-2">
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: recipe.id })}
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleteMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleEdit}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingDelete(true)}
                    aria-label="Delete recipe"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
              <SheetClose asChild>
                <Button type="button" variant="ghost">
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
