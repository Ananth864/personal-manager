import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
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
import { StateMarker } from './state-marker'
import { formatQuantity } from './format'
import type { InventoryItem, InventoryState } from '#/cooking/server/inventory/types'

export function EditIngredientSheet({
  item,
  onOpenChange,
}: {
  item: InventoryItem | null
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [restockQty, setRestockQty] = useState('')
  const [setQty, setSetQty] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const open = item !== null

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.inventory.list.queryKey() })
  }

  const restockMutation = useMutation(
    trpc.inventory.restock.mutationOptions({ onSuccess: invalidate }),
  )
  const setStateMutation = useMutation(
    trpc.inventory.setState.mutationOptions({ onSuccess: invalidate }),
  )
  const deleteMutation = useMutation(
    trpc.inventory.delete.mutationOptions({
      onSuccess: () => {
        invalidate()
        setConfirmingDelete(false)
        onOpenChange(false)
      },
    }),
  )

  function changeState(state: InventoryState, quantity?: number) {
    if (!item) return
    setStateMutation.mutate(
      { ingredientId: item.ingredient.id, state, quantity },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  function doRestock() {
    if (!item) return
    const amount = Number(restockQty)
    if (!Number.isFinite(amount) || amount <= 0) return
    restockMutation.mutate(
      { ingredientId: item.ingredient.id, quantity: amount },
      {
        onSuccess: () => {
          setRestockQty('')
          onOpenChange(false)
        },
      },
    )
  }

  function doSetQuantity() {
    if (!item) return
    const amount = Number(setQty)
    if (!Number.isFinite(amount) || amount <= 0) return
    changeState('tracked', amount)
    setSetQty('')
  }

  const pending =
    restockMutation.isPending || setStateMutation.isPending || deleteMutation.isPending
  const errorMessage =
    restockMutation.error?.message ?? setStateMutation.error?.message ?? deleteMutation.error?.message

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-lg">
                {item.ingredient.name}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <StateMarker state={item.state} />
                <span>
                  {stateLabel(item)} · unit is {item.ingredient.unit}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6">
              <div className="space-y-2">
                <Label htmlFor="restock">Restock</Label>
                <div className="flex gap-2">
                  <Input
                    id="restock"
                    inputMode="decimal"
                    placeholder={`amount in ${item.ingredient.unit}`}
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                  />
                  <Button type="button" onClick={doRestock} disabled={pending}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adds to what you have.
                </p>
              </div>

              {item.state === 'tracked' && (
                <div className="space-y-2">
                  <Label htmlFor="set-qty">Correct the count</Label>
                  <div className="flex gap-2">
                    <Input
                      id="set-qty"
                      inputMode="decimal"
                      placeholder={String(item.quantity ?? 0)}
                      value={setQty}
                      onChange={(e) => setSetQty(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={doSetQuantity}
                      disabled={pending}
                    >
                      Set
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>State</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={item.state === 'endless' ? 'secondary' : 'outline'}
                    onClick={() => changeState('endless')}
                    disabled={pending || item.state === 'endless'}
                  >
                    Mark endless
                  </Button>
                  <Button
                    type="button"
                    variant={item.state === 'unavailable' ? 'secondary' : 'outline'}
                    onClick={() => changeState('unavailable')}
                    disabled={pending || item.state === 'unavailable'}
                  >
                    Mark unavailable
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Endless treats it as a staple you never count. Unavailable
                  means none left.
                </p>
              </div>

              {errorMessage && (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>

            <SheetFooter className="sm:flex-col gap-2">
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={pending}
                    onClick={() => deleteMutation.mutate({ ingredientId: item.ingredient.id })}
                  >
                    {pending ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={pending}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete ingredient
                </Button>
              )}
              <SheetClose asChild>
                <Button type="button" variant="ghost">
                  Done
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function stateLabel(item: InventoryItem): string {
  if (item.state === 'endless') return 'Endless staple'
  if (item.state === 'unavailable') return 'Unavailable'
  const qty = formatQuantity(item.quantity)
  return `${qty} ${item.ingredient.unit} on hand`
}
