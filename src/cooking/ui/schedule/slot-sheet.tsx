import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useTRPC } from '#/integrations/trpc/react'
import { IngredientPickerRow } from '../ingredient-picker-row'
import type { PickerRow } from '../ingredient-picker-row'
import { RecipeBadge } from '../recipes/recipe-badge'
import { dayLabel } from '#/cooking/schedule/date-utils'
import type { MealSlot } from '#/cooking/server/schedule/types'

type Mode = 'menu' | 'recipe' | 'adhoc'

export function SlotSheet({
  slot,
  onOpenChange,
}: {
  slot: MealSlot | null
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('menu')
  const [adhocName, setAdhocName] = useState('')
  const [adhocRows, setAdhocRows] = useState<PickerRow[]>([])

  const open = slot !== null

  // Reset to the menu and clear the ad-hoc draft whenever a slot is opened.
  useEffect(() => {
    if (open) {
      setMode('menu')
      setAdhocName('')
      setAdhocRows([])
    }
  }, [open, slot?.date, slot?.meal])

  const recipesQuery = useQuery({
    ...trpc.recipes.list.queryOptions(),
    enabled: open,
  })
  const inventoryQuery = useQuery({
    ...trpc.inventory.list.queryOptions(),
    enabled: open && mode === 'adhoc',
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.schedule.getWeek.queryKey() })
  }

  const assignRecipeMut = useMutation(
    trpc.schedule.assignRecipe.mutationOptions({
      onSuccess: () => {
        invalidate()
        onOpenChange(false)
      },
    }),
  )
  const assignAdhocMut = useMutation(
    trpc.schedule.assignAdhoc.mutationOptions({
      onSuccess: () => {
        invalidate()
        onOpenChange(false)
      },
    }),
  )
  const markNoCookMut = useMutation(
    trpc.schedule.markNoCook.mutationOptions({
      onSuccess: () => {
        invalidate()
        onOpenChange(false)
      },
    }),
  )
  const clearMut = useMutation(
    trpc.schedule.clearSlot.mutationOptions({
      onSuccess: () => {
        invalidate()
        onOpenChange(false)
      },
    }),
  )

  if (!slot) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    )
  }

  const label = dayLabel(slot.date)
  const pending =
    assignRecipeMut.isPending ||
    assignAdhocMut.isPending ||
    markNoCookMut.isPending ||
    clearMut.isPending
  const errorMessage =
    assignRecipeMut.error?.message ??
    assignAdhocMut.error?.message ??
    markNoCookMut.error?.message ??
    clearMut.error?.message

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle className="font-display text-lg capitalize">
            {mode === 'menu' && `${label.weekday} ${slot.meal}`}
            {mode === 'recipe' && 'Choose a recipe'}
            {mode === 'adhoc' && 'Ad-hoc recipe'}
          </SheetTitle>
          <SheetDescription className="capitalize">
            {mode === 'menu' && (
              <>
                {label.weekday}, {label.month} {label.day} ·{' '}
                {summary(slot)}
              </>
            )}
            {mode !== 'menu' && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-left hover:underline"
                onClick={() => setMode('menu')}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </SheetDescription>
        </SheetHeader>

        {mode === 'menu' && (
          <Menu
            slot={slot}
            pending={pending}
            onRecipe={() => setMode('recipe')}
            onAdhoc={() => setMode('adhoc')}
            onNoCook={() =>
              markNoCookMut.mutate({ date: slot.date, meal: slot.meal })
            }
            onClear={() =>
              clearMut.mutate({ date: slot.date, meal: slot.meal })
            }
          />
        )}

        {mode === 'recipe' && (
          <RecipePicker
            recipes={recipesQuery.data ?? []}
            pending={assignRecipeMut.isPending}
            onPick={(recipeId) =>
              assignRecipeMut.mutate({ date: slot.date, meal: slot.meal, recipeId })
            }
          />
        )}

        {mode === 'adhoc' && (
          <AdhocForm
            name={adhocName}
            rows={adhocRows}
            ingredients={inventoryQuery.data ?? []}
            onName={setAdhocName}
            onRows={setAdhocRows}
            pending={assignAdhocMut.isPending}
            onSave={() =>
              assignAdhocMut.mutate({
                date: slot.date,
                meal: slot.meal,
                name: adhocName.trim() || null,
                ingredients: adhocRows.map((r) => ({
                  ingredientId: r.ingredientId,
                  quantity: Number(r.quantity),
                })),
              })
            }
          />
        )}

        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}

function summary(slot: MealSlot): string {
  const a = slot.assignment
  if (!a) return 'Not planned'
  if (a.type === 'recipe') return a.recipeName ?? 'Recipe'
  if (a.type === 'adhoc') return a.adhocName?.trim() ? a.adhocName : 'Ad-hoc recipe'
  if (a.type === 'nocook') return 'No cook'
  return 'Food Bank'
}

function Menu({
  slot,
  pending,
  onRecipe,
  onAdhoc,
  onNoCook,
  onClear,
}: {
  slot: MealSlot
  pending: boolean
  onRecipe: () => void
  onAdhoc: () => void
  onNoCook: () => void
  onClear: () => void
}) {
  const assigned = slot.assignment !== null
  return (
    <div className="flex flex-1 flex-col gap-2">
      <MenuButton label="Assign a recipe" hint="From your catalog" onClick={onRecipe} disabled={pending} />
      <MenuButton label="Add an ad-hoc recipe" hint="A one-off ingredient list" onClick={onAdhoc} disabled={pending} />
      <MenuButton
        label="Mark as No Cook"
        hint="Eating out, skipping, fasting"
        onClick={onNoCook}
        disabled={pending || slot.assignment?.type === 'nocook'}
      />
      <MenuButton
        label="From the Food Bank"
        hint="Coming in a later update"
        disabled
      />
      {assigned && (
        <MenuButton
          label="Clear this meal"
          hint="Leave it unplanned"
          onClick={onClear}
          disabled={pending}
          destructive
        />
      )}
    </div>
  )
}

function MenuButton({
  label,
  hint,
  onClick,
  disabled,
  destructive,
}: {
  label: string
  hint: string
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>
        <span
          className={`block text-sm font-medium ${
            destructive ? 'text-destructive' : ''
          }`}
        >
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}

function RecipePicker({
  recipes,
  pending,
  onPick,
}: {
  recipes: { id: string; name: string; availability: { ok: boolean; missingCount: number } }[]
  pending: boolean
  onPick: (id: string) => void
}) {
  if (recipes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        You don't have any recipes yet. Add one from the Recipes tab first.
      </p>
    )
  }
  return (
    <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
      {recipes.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            disabled={pending}
            onClick={() => onPick(r.id)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <span className="text-sm font-medium">{r.name}</span>
            <RecipeBadge availability={r.availability} className="shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function AdhocForm({
  name,
  rows,
  ingredients,
  onName,
  onRows,
  pending,
  onSave,
}: {
  name: string
  rows: PickerRow[]
  ingredients: { ingredient: { id: string; name: string; unit: string } }[]
  onName: (v: string) => void
  onRows: (rows: PickerRow[]) => void
  pending: boolean
  onSave: () => void
}) {
  const byId = new Map(ingredients.map((i) => [i.ingredient.id, i.ingredient]))
  const canSubmit =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.ingredientId !== '' &&
        Number.isFinite(Number(r.quantity)) &&
        Number(r.quantity) > 0,
    )

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="adhoc-name">Name (optional)</Label>
        <Input
          id="adhoc-name"
          placeholder="e.g. Quick toast"
          value={name}
          onChange={(e) => onName(e.target.value)}
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
              onClick={() => onRows([...rows, { ingredientId: '', quantity: '' }])}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
        {ingredients.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            Add ingredients to your inventory first.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Tap “Add” to list what this meal needs.
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
                  onRows(rows.map((r, i) => (i === index ? next : r)))
                }
                onRemove={() => onRows(rows.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        )}
      </div>

      <SheetClose asChild>
        <Button type="button" onClick={onSave} disabled={!canSubmit || pending}>
          Save ad-hoc recipe
        </Button>
      </SheetClose>
    </div>
  )
}
