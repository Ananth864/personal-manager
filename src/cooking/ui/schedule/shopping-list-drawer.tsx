import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useTRPC } from '#/integrations/trpc/react'
import { formatQuantity } from '../inventory/format'

/**
 * The Shopping List drawer (CONTEXT.md → Shopping List; T07). A derived view of
 * ingredients required by planned fresh cooks that aren't fully available.
 * Opens from the Schedule header; checking off an item prompts for the quantity
 * bought and restocks Inventory (additive). Recomputes live from Schedule +
 * Inventory after every restock.
 */
export function ShoppingListDrawer() {
  const trpc = useTRPC()
  const query = useQuery(trpc.shoppingList.list.queryOptions())
  const items = query.data ?? []
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <ShoppingCart className="h-4 w-4" />
        List
        {items.length > 0 ? (
          <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
            {items.length}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col gap-4">
          <SheetHeader>
            <SheetTitle className="font-display text-lg">Shopping List</SheetTitle>
            <SheetDescription>
              {items.length === 0
                ? 'Nothing to buy — your planned meals are covered.'
                : `${items.length} item${items.length === 1 ? '' : 's'} to buy for your planned meals.`}
            </SheetDescription>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="px-6 text-center text-sm text-muted-foreground">
                Add meals to the schedule and run short on ingredients to see them here.
              </p>
            </div>
          ) : (
            <ul className="flex-1 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <ShoppingRow key={item.ingredientId} item={item} />
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function ShoppingRow({
  item,
}: {
  item: {
    ingredientId: string
    name: string
    unit: string
    needed: number
    have: number
    buy: number
  }
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [restocking, setRestocking] = useState(false)
  const [qty, setQty] = useState(String(item.buy))

  const restockMut = useMutation(
    trpc.inventory.restock.mutationOptions({
      onSuccess: () => {
        // The list is derived from Inventory, so refresh both views.
        queryClient.invalidateQueries({ queryKey: trpc.shoppingList.list.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.inventory.list.queryKey() })
        setRestocking(false)
        setQty(String(item.buy))
      },
    }),
  )

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
        onClick={() => {
          setRestocking((r) => !r)
          setQty(String(item.buy))
        }}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            need {formatQuantity(item.needed)} {item.unit}
            {item.have > 0 ? ` · have ${formatQuantity(item.have)}` : ''}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-accent-warm/15 px-2.5 py-1 text-xs font-semibold text-accent-warm-foreground">
          buy {formatQuantity(item.buy)} {item.unit}
        </span>
      </button>

      {restocking ? (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <Input
            type="number"
            inputMode="decimal"
            className="h-8"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label={`Quantity of ${item.name} bought`}
          />
          <Button
            type="button"
            size="sm"
            disabled={restockMut.isPending || Number(qty) <= 0}
            onClick={() =>
              restockMut.mutate({
                ingredientId: item.ingredientId,
                quantity: Number(qty),
              })
            }
          >
            Restock
          </Button>
          {restockMut.isError ? (
            <span className="text-xs text-destructive">{restockMut.error.message}</span>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
