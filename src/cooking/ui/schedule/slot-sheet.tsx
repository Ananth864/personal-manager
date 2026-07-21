import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, Plus, RotateCcw, Utensils } from 'lucide-react'
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
import { formatQuantity } from '../inventory/format'
import { dayLabel } from '#/cooking/schedule/date-utils'
import type { MealSlot } from '#/cooking/server/schedule/types'
import type { CookPreview } from '#/cooking/server/schedule/cook'

type Mode = 'menu' | 'recipe' | 'adhoc' | 'cook' | 'foodbank'

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
  const [adhocServings, setAdhocServings] = useState('1')
  const [adhocRows, setAdhocRows] = useState<PickerRow[]>([])

  const open = slot !== null

  // Reset to the menu and clear the ad-hoc draft whenever a slot is opened.
  useEffect(() => {
    if (open) {
      setMode('menu')
      setAdhocName('')
      setAdhocServings('1')
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
  const cookPreviewQuery = useQuery({
    ...trpc.schedule.previewCook.queryOptions({
      date: slot?.date ?? '',
      meal: slot?.meal ?? 'lunch',
    }),
    enabled: open && mode === 'cook',
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.schedule.getWeek.queryKey() })
    // assignRecipe/assignAdhoc/markNoCook/clearSlot all change the planned-cook
    // set feeding the Food Bank's projected availability and the Shopping List,
    // so refresh both too.
    queryClient.invalidateQueries({ queryKey: trpc.foodBank.summary.queryKey() })
    queryClient.invalidateQueries({ queryKey: trpc.shoppingList.list.queryKey() })
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
  const cookMut = useMutation(
    trpc.schedule.cook.mutationOptions({
      onSuccess: () => {
        // Cook mutates Inventory, produces Food Bank portions, marks the slot
        // cooked (removing it from the planned set), and consumes ingredients —
        // refresh all four views.
        queryClient.invalidateQueries({ queryKey: trpc.schedule.getWeek.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.inventory.list.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.foodBank.summary.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.shoppingList.list.queryKey() })
        onOpenChange(false)
      },
    }),
  )
  const assignFoodBankMut = useMutation(
    trpc.schedule.assignFoodBank.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.schedule.getWeek.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.foodBank.summary.queryKey() })
        onOpenChange(false)
      },
    }),
  )
  const uncookMut = useMutation(
    trpc.schedule.uncook.mutationOptions({
      onSuccess: () => {
        // Uncook restores Inventory, reverses Food Bank production, releases the
        // cooked flag (re-adding the slot to the planned set), and un-consumes
        // ingredients — refresh all four views.
        queryClient.invalidateQueries({ queryKey: trpc.schedule.getWeek.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.inventory.list.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.foodBank.summary.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.shoppingList.list.queryKey() })
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
    clearMut.isPending ||
    cookMut.isPending ||
    assignFoodBankMut.isPending ||
    uncookMut.isPending
  const errorMessage =
    assignRecipeMut.error?.message ??
    assignAdhocMut.error?.message ??
    markNoCookMut.error?.message ??
    clearMut.error?.message ??
    cookMut.error?.message ??
    assignFoodBankMut.error?.message ??
    uncookMut.error?.message

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle className="font-display text-lg capitalize">
            {mode === 'menu' && `${label.weekday} ${slot.meal}`}
            {mode === 'recipe' && 'Choose a recipe'}
            {mode === 'adhoc' && 'Ad-hoc recipe'}
            {mode === 'cook' && 'Cook meal'}
            {mode === 'foodbank' && 'From the Food Bank'}
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
            onCook={() => setMode('cook')}
            onRecipe={() => setMode('recipe')}
            onAdhoc={() => setMode('adhoc')}
            onFoodBank={() => setMode('foodbank')}
            onNoCook={() =>
              markNoCookMut.mutate({ date: slot.date, meal: slot.meal })
            }
            onClear={() =>
              clearMut.mutate({ date: slot.date, meal: slot.meal })
            }
            onUncook={() =>
              uncookMut.mutate({ date: slot.date, meal: slot.meal })
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
            servings={adhocServings}
            rows={adhocRows}
            ingredients={inventoryQuery.data ?? []}
            onName={setAdhocName}
            onServings={setAdhocServings}
            onRows={setAdhocRows}
            pending={assignAdhocMut.isPending}
            onSave={() =>
              assignAdhocMut.mutate({
                date: slot.date,
                meal: slot.meal,
                name: adhocName.trim() || null,
                servings: Number(adhocServings) || 1,
                ingredients: adhocRows.map((r) => ({
                  ingredientId: r.ingredientId,
                  quantity: Number(r.quantity),
                })),
              })
            }
          />
        )}

        {mode === 'cook' && (
          <CookConfirm
            preview={cookPreviewQuery.data ?? null}
            loading={cookPreviewQuery.isLoading}
            pending={cookMut.isPending}
            onConfirm={() =>
              cookMut.mutate({ date: slot.date, meal: slot.meal })
            }
          />
        )}

        {mode === 'foodbank' && (
          <FoodBankPicker
            pending={assignFoodBankMut.isPending}
            onPick={(recipeId) =>
              assignFoodBankMut.mutate({
                date: slot.date,
                meal: slot.meal,
                recipeId,
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
  return a.recipeName ? `${a.recipeName} (Food Bank)` : 'Food Bank'
}

function Menu({
  slot,
  pending,
  onCook,
  onRecipe,
  onAdhoc,
  onFoodBank,
  onNoCook,
  onClear,
  onUncook,
}: {
  slot: MealSlot
  pending: boolean
  onCook: () => void
  onRecipe: () => void
  onAdhoc: () => void
  onFoodBank: () => void
  onNoCook: () => void
  onClear: () => void
  onUncook: () => void
}) {
  const assigned = slot.assignment !== null
  const a = slot.assignment
  const cookable = a !== null && (a.type === 'recipe' || a.type === 'adhoc')
  return (
    <div className="flex flex-1 flex-col gap-2">
      {cookable && !slot.cooked && (
        <Button type="button" onClick={onCook} disabled={pending} className="w-full">
          <Utensils className="h-4 w-4" /> Cook this meal
        </Button>
      )}
      {slot.cooked && (
        <>
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-primary">
            <Check className="h-4 w-4" /> Cooked
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onUncook}
            disabled={pending}
            className="w-full"
          >
            <RotateCcw className="h-4 w-4" /> Uncook this meal
          </Button>
          <p className="px-1 text-xs text-muted-foreground">
            Reverses the cook: restores consumed ingredients and pulls the
            banked portions back from the Food Bank.
          </p>
        </>
      )}
      <MenuButton label="Assign a recipe" hint="From your catalog" onClick={onRecipe} disabled={pending} />
      <MenuButton label="Add an ad-hoc recipe" hint="A one-off ingredient list" onClick={onAdhoc} disabled={pending} />
      <MenuButton
        label="From the Food Bank"
        hint="Reserve a prepared portion"
        onClick={onFoodBank}
        disabled={pending}
      />
      <MenuButton
        label="Mark as No Cook"
        hint="Eating out, skipping, fasting"
        onClick={onNoCook}
        disabled={pending || slot.assignment?.type === 'nocook'}
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
  servings,
  rows,
  ingredients,
  onName,
  onServings,
  onRows,
  pending,
  onSave,
}: {
  name: string
  servings: string
  rows: PickerRow[]
  ingredients: { ingredient: { id: string; name: string; unit: string } }[]
  onName: (v: string) => void
  onServings: (v: string) => void
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
    ) &&
    Number.isInteger(Number(servings)) &&
    Number(servings) >= 1

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
        <Label htmlFor="adhoc-servings">Servings</Label>
        <Input
          id="adhoc-servings"
          inputMode="numeric"
          placeholder="1"
          value={servings}
          onChange={(e) => onServings(e.target.value)}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          How many portions this cook adds to the Food Bank.
        </p>
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

function CookConfirm({
  preview,
  loading,
  pending,
  onConfirm,
}: {
  preview: CookPreview | null
  loading: boolean
  pending: boolean
  onConfirm: () => void
}) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Working out what you'll use…</p>
    )
  }
  if (!preview) {
    return (
      <p className="text-sm text-muted-foreground">
        There's nothing to cook here.
      </p>
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {preview.lines.map((l) => (
          <li key={l.ingredientId} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{l.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {l.currentState === 'endless'
                  ? 'staple'
                  : `${formatQuantity(l.currentQty) ?? 0} ${l.unit} → ${formatQuantity(l.newQty) ?? 0} ${l.unit}`}
              </span>
            </div>
            {l.warning && (
              <p className="mt-0.5 text-xs text-accent-warm-foreground">
                {l.currentState === 'unavailable'
                  ? 'Unavailable — cooking will skip it.'
                  : 'Not enough on hand — it will run out.'}
              </p>
            )}
          </li>
        ))}
      </ul>
      {preview.portionsToProduce > 0 && (
        <p className="text-xs text-muted-foreground">
          Produces {preview.portionsToProduce} portion
          {preview.portionsToProduce === 1 ? '' : 's'} into the Food Bank.
        </p>
      )}
      <Button type="button" onClick={onConfirm} disabled={pending}>
        {pending ? 'Cooking…' : 'Confirm cook'}
      </Button>
    </div>
  )
}

function FoodBankPicker({
  pending,
  onPick,
}: {
  pending: boolean
  onPick: (recipeId: string | null) => void
}) {
  const trpc = useTRPC()
  const query = useQuery(trpc.foodBank.summary.queryOptions())
  const entries = (query.data ?? []).filter((e) => e.available > 0)

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading the Food Bank…</p>
  }
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No portions in the Food Bank yet. Cook a recipe first.
      </p>
    )
  }
  return (
    <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
      {entries.map((e) => (
        <li key={e.recipeId ?? '__adhoc__'}>
          <button
            type="button"
            disabled={pending}
            onClick={() => onPick(e.recipeId)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <span className="text-sm font-medium">{e.recipeName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              ×{e.available} available
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
