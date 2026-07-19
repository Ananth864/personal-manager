# Personal Manager — Cooking

The first context of a personal life-manager app: planning weekly meals, managing recipes, and tracking ingredient inventory. Sibling contexts for other life purposes (parallel trackers) will follow; when the second one arrives, this file moves under `src/cooking/` and a root `CONTEXT-MAP.md` is added.

## Language

### Ingredients & Inventory

**Ingredient**:
A catalog identity for something that can be kept in a kitchen (e.g., Egg, Flour, Salt). Referenced by Recipes and Inventory; carries a canonical unit (the unit all its quantities are expressed in) but no quantity or availability itself.
_Avoid_: item, product, food, supply

**Inventory**:
The current state of an Ingredient in the user's kitchen. Each Inventory entry is in exactly one of three states: Endless, Tracked, or Unavailable.
_Avoid_: stock, pantry, supplies

**Endless**:
An Inventory state — the ingredient is available but unquantified; never decremented. Used for staples the user doesn't want to track (salt, oil).
_Avoid_: infinite, unlimited

**Tracked**:
An Inventory state — the ingredient is available with a quantity greater than zero; decremented when a Recipe that requires it is cooked.
_Avoid_: counted, quantified

**Unavailable**:
An Inventory state — the ingredient is not available (quantity is zero, or explicitly marked out). Cooking a Recipe that requires it triggers a warning (not a block); the cook may proceed, with the ingredient staying Unavailable (no negative quantities).
_Avoid_: out, empty, missing

### Recipes

**Recipe**:
A named, reusable collection of Ingredients with required quantities, stored in the recipe catalog. Can be assigned to a Meal Slot. Authored by the user or the agent.
_Avoid_: meal, dish

**Ad-hoc Recipe**:
An ingredient list with required quantities, bound to a single Meal Slot and not saved to the recipe catalog. Cooks and decrements Inventory exactly like a Recipe, but is one-off and not reusable.
_Avoid_: custom recipe, one-off, throwaway

### Scheduling

**Schedule**:
The set of Meal Slots for a fixed Week. Filled by Recipes, Ad-hoc Recipes, Food Bank withdrawals, or No Cook. Mutating the Schedule never touches Inventory. Plannable horizon: the current Week and the next; past Weeks are read-only archives.
_Avoid_: plan, meal plan, roster

**Week**:
The Schedule's fixed unit — Monday through Sunday. The Schedule is organized, viewed, and archived by Week.
_Avoid_: rolling week, 7-day window

**Meal Slot**:
One cell of the Schedule: a specific day and one of two meal positions, Lunch or Dinner. Holds at most one assignment — a Recipe or Ad-hoc Recipe to be cooked fresh, a withdrawal from the Food Bank, or No Cook.
_Avoid_: slot, entry

**No Cook**:
A Meal Slot marker indicating no cooking occurs for that slot — no Recipe, no Ad-hoc, no Food Bank withdrawal. Distinct from an unassigned slot: an unassigned slot is a planning gap the agent may fill; No Cook is an explicit decision not to cook (eating out, skipping, fasting). No inventory effect.
_Avoid_: eating out, skip, off

**Cook**:
A logged event that consumes ingredients and produces prepared food. Each Tracked Ingredient required by the Recipe or Ad-hoc Recipe is decremented by its required quantity (Tracked → Unavailable at zero); Endless ingredients are unaffected. Adds the recipe's `servings` worth of food to the Food Bank. Cook is the only thing that mutates Tracked Inventory or produces Food Bank portions.
_Avoid_: prepare, make

**Food Bank**:
The pool of prepared portions from past Cooks, available to be reserved by a Meal Slot. Reserving a portion at plan time reduces availability; clearing the slot releases it; when a Week archives, its reservations become permanent consumption. Tracked per Recipe (commingled across Cooks of the same Recipe). Reserving has no effect on Ingredient Inventory — ingredients were consumed at Cook time.
_Avoid_: leftovers, prep bank, cooked bank

### Derived Views

**Shopping List**:
A derived view (not a stored object) listing ingredients required by planned fresh Cooks that aren't fully available — Unavailable, or Tracked with insufficient quantity. Endless ingredients never appear. Computed from the Schedule and Inventory.
_Avoid_: grocery list, buy list
