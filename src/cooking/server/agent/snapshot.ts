import type { InventoryItem } from '../inventory/types'
import type { Week } from '../schedule/types'
import type { FoodBankEntry } from '../food-bank/availability'

/**
 * Build a compact, plain-text snapshot of the user's current domain state to
 * inject as the agent's per-turn context (ADR-0007). Fresh each turn so the
 * model never acts on stale inventory/schedule. Covers Inventory, the current
 * Week's Schedule, and Food Bank availability.
 */
export function buildStateSnapshot(
  week: Week,
  inventory: InventoryItem[],
  foodBank: FoodBankEntry[],
): string {
  const lines: string[] = []

  lines.push('INVENTORY:')
  if (inventory.length === 0) {
    lines.push('  (empty)')
  } else {
    for (const item of inventory) {
      const qty =
        item.state === 'tracked'
          ? `${item.quantity ?? 0} ${item.ingredient.unit}`
          : item.state === 'endless'
            ? 'endless'
            : 'unavailable'
      lines.push(`  - ${item.ingredient.name} (${item.ingredient.id}): ${qty} [${item.state}]`)
    }
  }

  lines.push('')
  lines.push(`SCHEDULE — week of ${week.weekStart}:`)
  for (const day of week.days) {
    const dayName = new Date(`${day.date}T00:00:00`).toLocaleDateString('en', {
      weekday: 'short',
    })
    lines.push(`  ${dayName} ${day.date}`)
    lines.push(`    lunch: ${slotSummary(day.lunch)}`)
    lines.push(`    dinner: ${slotSummary(day.dinner)}`)
  }

  const available = foodBank.filter((e) => e.available > 0)
  lines.push('')
  lines.push('FOOD BANK:')
  if (available.length === 0) {
    lines.push('  (no portions available)')
  } else {
    for (const e of available) {
      lines.push(`  - ${e.recipeName}: ${e.available} available`)
    }
  }

  return lines.join('\n')
}

function slotSummary(slot: Week['days'][number]['lunch']): string {
  if (!slot.assignment) return '—'
  if (slot.cooked) return `${assignmentLabel(slot.assignment)} (cooked)`
  return assignmentLabel(slot.assignment)
}

/** A short label for a slot's assignment (shared by the snapshot + query tools). */
export function assignmentLabel(
  a: NonNullable<Week['days'][number]['lunch']['assignment']>,
): string {
  switch (a.type) {
    case 'recipe':
      return a.recipeName ?? 'Recipe'
    case 'adhoc':
      return a.adhocName?.trim() ? a.adhocName : 'Ad-hoc recipe'
    case 'foodbank':
      return a.recipeName ? `${a.recipeName} (Food Bank)` : 'Food Bank'
    case 'nocook':
      return 'No cook'
    default:
      return '—'
  }
}
