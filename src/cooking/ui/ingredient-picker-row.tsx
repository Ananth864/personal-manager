import { X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

/** A dynamic ingredient-line row: an ingredient picker + a quantity field. */
export interface PickerRow {
  ingredientId: string
  quantity: string
}

/**
 * Shared ingredient-picker row used by the Recipe form and the Ad-hoc Recipe
 * form. `options` should already exclude ingredients chosen on other rows.
 */
export function IngredientPickerRow({
  value,
  options,
  unit,
  onChange,
  onRemove,
}: {
  value: PickerRow
  options: { id: string; name: string }[]
  unit: string | null
  onChange: (next: PickerRow) => void
  onRemove: () => void
}) {
  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-2">
      <Select
        value={value.ingredientId}
        onValueChange={(v: string) => onChange({ ...value, ingredientId: v })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pick an ingredient" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          placeholder="amount"
          value={value.quantity}
          onChange={(e) => onChange({ ...value, quantity: e.target.value })}
          className="flex-1"
        />
        <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
          {unit ?? 'unit'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label="Remove ingredient"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  )
}
