import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
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
import type { InventoryState } from '#/cooking/server/inventory/types'

const STATES: { value: InventoryState; label: string; hint: string }[] = [
  { value: 'tracked', label: 'Tracked', hint: 'A quantity you keep count of.' },
  { value: 'endless', label: 'Endless', hint: 'A staple you never track.' },
  { value: 'unavailable', label: 'Unavailable', hint: 'None left — add some to restock.' },
]

export function AddIngredientSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [state, setState] = useState<InventoryState>('tracked')
  const [quantity, setQuantity] = useState('')

  const addMutation = useMutation(
    trpc.inventory.add.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.inventory.list.queryKey(),
        })
        reset()
        onOpenChange(false)
      },
    }),
  )

  function reset() {
    setName('')
    setUnit('')
    setState('tracked')
    setQuantity('')
  }

  function submit() {
    addMutation.mutate({
      name: name.trim(),
      unit: unit.trim(),
      state,
      quantity: state === 'tracked' ? Number(quantity) : null,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">Add an ingredient</SheetTitle>
          <SheetDescription>
            Name it and set how you want to track it.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ing-name">Name</Label>
            <Input
              id="ing-name"
              placeholder="Egg, Milk, Flour…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ing-unit">Canonical unit</Label>
            <Input
              id="ing-unit"
              placeholder="piece, g, ml, cup…"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Every quantity for this ingredient will be in this unit.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tracking</Label>
            <Select
              value={state}
              onValueChange={(v: string) => setState(v as InventoryState)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {STATES.find((s) => s.value === state)?.hint}
            </p>
          </div>

          {state === 'tracked' && (
            <div className="space-y-2">
              <Label htmlFor="ing-qty">Quantity on hand</Label>
              <Input
                id="ing-qty"
                inputMode="decimal"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          )}

          {addMutation.error && (
            <p className="text-sm text-destructive" role="alert">
              {addMutation.error.message}
            </p>
          )}

          <SheetFooter className="mt-auto gap-2 sm:flex-col">
            <Button
              type="submit"
              disabled={addMutation.isPending || !name.trim() || !unit.trim()}
            >
              {addMutation.isPending ? 'Adding…' : 'Add ingredient'}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
