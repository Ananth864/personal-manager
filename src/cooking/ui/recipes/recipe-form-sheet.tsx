import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
import { IngredientPickerRow } from '../ingredient-picker-row'
import type { RecipeWithAvailability } from '#/cooking/server/recipes/types'

interface Row {
  ingredientId: string
  quantity: string
}

/**
 * Combined add/edit form. When `recipe` is null the sheet creates a new recipe;
 * when set it edits that recipe. Ingredient lines pick from the user's
 * inventory catalog (a Recipe can only reference existing Ingredients).
 */
export function RecipeFormSheet({
  open,
  onOpenChange,
  recipe,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: RecipeWithAvailability | null
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const inventoryQuery = useQuery(trpc.inventory.list.queryOptions())

  const [name, setName] = useState('')
  const [servings, setServings] = useState('2')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const editing = recipe ?? null

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setServings(String(editing.servings))
      setNotes(editing.notes ?? '')
      setRows(
        editing.ingredients.map((i) => ({
          ingredientId: i.ingredient.id,
          quantity: String(i.quantity),
        })),
      )
    } else {
      setName('')
      setServings('2')
      setNotes('')
      setRows([])
    }
  }, [open, editing])

  const createMutation = useMutation(
    trpc.recipes.create.mutationOptions({
      onSuccess: () => invalidateAndClose(),
    }),
  )
  const updateMutation = useMutation(
    trpc.recipes.update.mutationOptions({
      onSuccess: () => invalidateAndClose(),
    }),
  )

  function invalidateAndClose() {
    queryClient.invalidateQueries({ queryKey: trpc.recipes.list.queryKey() })
    reset()
    onOpenChange(false)
  }

  function reset() {
    setName('')
    setServings('2')
    setNotes('')
    setRows([])
  }

  const ingredients = inventoryQuery.data ?? []
  const byId = new Map(ingredients.map((i) => [i.ingredient.id, i.ingredient]))

  const canSubmit = (() => {
    if (!name.trim()) return false
    const s = Number(servings)
    if (!Number.isInteger(s) || s < 1) return false
    if (rows.length === 0) return false
    return rows.every((r) => {
      const q = Number(r.quantity)
      return r.ingredientId !== '' && Number.isFinite(q) && q > 0
    })
  })()

  function submit() {
    if (!canSubmit) return
    const payload = {
      name: name.trim(),
      servings: Number(servings),
      notes: notes.trim() || null,
      ingredients: rows.map((r) => ({
        ingredientId: r.ingredientId,
        quantity: Number(r.quantity),
      })),
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending
  const errorMessage = createMutation.error?.message ?? updateMutation.error?.message

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {editing ? 'Edit recipe' : 'New recipe'}
          </SheetTitle>
          <SheetDescription>
            Name it, set servings, and list the ingredients it needs.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="rcp-name">Name</Label>
            <Input
              id="rcp-name"
              placeholder="Omelette, dal, stir-fry…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcp-servings">Servings</Label>
            <Input
              id="rcp-servings"
              inputMode="numeric"
              placeholder="2"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-24"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ingredients</Label>
              {ingredients.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((rs) => [...rs, { ingredientId: '', quantity: '' }])}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>

            {ingredients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Add ingredients to your inventory first — a recipe can only use
                ingredients you track.
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Tap “Add” to list what this recipe needs.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row, index) => (
                  <IngredientPickerRow
                    key={index}
                    value={row}
                    options={ingredients
                      .filter(
                        (i) =>
                          i.ingredient.id === row.ingredientId ||
                          !rows.some((r) => r.ingredientId === i.ingredient.id),
                      )
                      .map((i) => i.ingredient)}
                    unit={byId.get(row.ingredientId)?.unit ?? null}
                    onChange={(next) =>
                      setRows((rs) => rs.map((r, i) => (i === index ? next : r)))
                    }
                    onRemove={() =>
                      setRows((rs) => rs.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcp-notes">Notes</Label>
            <textarea
              id="rcp-notes"
              placeholder="Method, tips, variations…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <SheetFooter>
          <Button type="button" onClick={submit} disabled={!canSubmit || pending}>
            {editing ? 'Save changes' : 'Add recipe'}
          </Button>
          <SheetClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
