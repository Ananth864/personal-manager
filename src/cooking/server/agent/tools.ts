import { z } from 'zod'
import type { InventoryRepo } from '../inventory/repo'
import {
  listInventory,
  restockIngredient,
  setIngredientState,
} from '../inventory/service'
import type { InventoryItem } from '../inventory/types'

/** A compact, JSON-serializable view of an Inventory item for tool results. */
function toItemView(item: InventoryItem) {
  return {
    id: item.ingredient.id,
    name: item.ingredient.name,
    unit: item.ingredient.unit,
    state: item.state,
    quantity: item.quantity,
  }
}

/**
 * The T08 agent tools (ADR-0007) — three thin wrappers over the Inventory
 * service layer, so the agent runs the *same* logic the UI does and RLS scopes
 * every write to the user. `restock_ingredient` is additive; `set_ingredient_state`
 * is absolute (sets a new state, with quantity for Tracked). Notably absent:
 * anything that triggers Cook, edits recipes, or touches the DB directly — the
 * autonomy rules from ADR-0003 are enforced by the tool surface, not the prompt.
 */
export function createInventoryTools(repo: InventoryRepo) {
  return {
    query_inventory: {
      description:
        "List every ingredient in the user's inventory with its id, name, unit, state (endless/tracked/unavailable), and quantity. Call this to see what the user has before updating it.",
      inputSchema: z.object({}),
      execute: async () => {
        const items = await listInventory(repo)
        return { inventory: items.map(toItemView) }
      },
    },

    restock_ingredient: {
      description:
        "Add to an ingredient's quantity (additive). Use when the user reports buying or obtaining more of something, e.g. \"I bought 6 eggs\". Requires the ingredient id (from query_inventory) and a positive quantity.",
      inputSchema: z.object({
        ingredientId: z.string().min(1),
        quantity: z.number().positive(),
      }),
      execute: async ({ ingredientId, quantity }: { ingredientId: string; quantity: number }) => {
        const item = await restockIngredient(repo, ingredientId, quantity)
        return { ingredient: toItemView(item) }
      },
    },

    set_ingredient_state: {
      description:
        'Set an ingredient to a new state: "endless" (a staple, stop tracking quantity), "tracked" (available with a positive quantity — provide it), or "unavailable" (out of stock, e.g. "we finished the milk"). Requires the ingredient id.',
      inputSchema: z.object({
        ingredientId: z.string().min(1),
        state: z.enum(['endless', 'tracked', 'unavailable']),
        quantity: z.number().positive().optional(),
      }),
      execute: async ({
        ingredientId,
        state,
        quantity,
      }: {
        ingredientId: string
        state: 'endless' | 'tracked' | 'unavailable'
        quantity?: number
      }) => {
        const item = await setIngredientState(repo, ingredientId, state, {
          quantity,
        })
        return { ingredient: toItemView(item) }
      },
    },
  }
}
