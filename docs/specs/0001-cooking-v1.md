# Spec: Personal Manager — Cooking (v1)

## Problem Statement

Planning what to cook each week, keeping track of what ingredients I actually have in my kitchen, and reconciling the two (what I can cook vs. what I need to buy) is a constant mental burden. I forget what's in the fridge, double-buy staples, let ingredients go unused, and never have a clear answer to "what am I cooking tonight?" I want a single mobile-first place that holds my weekly cooking schedule, knows the state of my kitchen, and can plan around both — and I want to be able to drive it either by tapping through a UI or by talking to an agent that does the data entry and planning for me.

## Solution

A mobile-first PWA ("Personal Manager") whose first context is **Cooking**: a weekly meal Schedule (Mon–Sun, Lunch & Dinner), a Recipe catalog, an Ingredient Inventory with three states (Endless / Tracked / Unavailable), a Food Bank of prepared portions from batch cooks, and a derived Shopping List. The user interacts via a four-surface UI (Schedule, Inventory, Recipes, Chat) or via a reactive chat agent that reads the full domain and writes the Schedule, Recipe/Ingredient catalog, and Inventory on instruction. Cooking is a deliberate, user-triggered event that consumes ingredients and produces Food Bank portions; planning is decoupled from consumption and never touches Inventory. The app is structured as a bounded context so future sibling life-purpose trackers can plug in alongside it.

## User Stories

### Auth & delivery
1. As the user, I want to log in via Clerk, so that my cooking data is scoped to me and private.
2. As the user, I want Row-Level Security to scope every query to my account, so that no data leaks across users.
3. As the user, I want to install the app to my phone home screen (PWA), so that it behaves like a native daily-use app.
4. As the user, I want push notifications (PWA capability), so that I can be reminded to cook or restock.

### Schedule (planning)
5. As the user, I want to view my current Week's Schedule (Mon–Sun, Lunch & Dinner per day), so that I see what's planned.
6. As the user, I want the Schedule to open scrolled to today with today highlighted, so that I instantly see today's meals.
7. As the user, I want past days in the current Week dimmed, so that I see what has lapsed without losing context.
8. As the user, I want to switch between the current and next Week, so that I plan ahead (2-week horizon).
9. As the user, I want to view past Weeks as read-only archives, so that I can recall what I cooked.
10. As the user, I want to assign a Recipe to a Meal Slot, so that I plan a fresh cook.
11. As the user, I want to assign an Ad-hoc Recipe to a Meal Slot, so that I plan a one-off meal without polluting the catalog.
12. As the user, I want to reserve a Food Bank portion for a Meal Slot, so that I plan to eat leftovers.
13. As the user, I want to mark a Meal Slot as No Cook, so that I indicate no cooking happens (eating out, skipping, fasting).
14. As the user, I want to clear a Meal Slot, so that I can change my plan.
15. As the user, I want a soft, non-blocking flag on slots whose Recipes require unavailable/insufficient ingredients, so that I know a shop is needed before cooking.
16. As the user, I want Schedule mutations to never touch Inventory, so that re-planning is free and churn doesn't corrupt stock.

### Inventory
17. As the user, I want to view my Inventory grouped by state (Tracked, Endless, Unavailable), so that I see what I have, what's out, and what's a staple.
18. As the user, I want to add an Ingredient to my Inventory (search the catalog or create new with name + canonical unit), so that I start tracking it.
19. As the user, I want to restock an Ingredient (additive quantity), so that I log a purchase.
20. As the user, I want to set an Ingredient's exact quantity (absolute), so that I correct drift.
21. As the user, I want to mark an Ingredient Unavailable, so that I log that I'm out.
22. As the user, I want to mark an Ingredient Endless, so that I treat it as a never-decremented staple.
23. As the user, I want to search my Inventory, so that I find an Ingredient fast.

### Recipes
24. As the user, I want to browse my Recipe catalog by name, so that I pick what to cook.
25. As the user, I want a cookability badge on each Recipe (✓ available / ⚠ missing N), so that I know if I can cook it now.
26. As the user, I want to view a Recipe's details (ingredients, quantities, servings, notes), so that I know what it requires.
27. As the user, I want to add a Recipe (name, ingredients + quantities, servings, notes), so that I can reuse it.
28. As the user, I want to edit a Recipe, so that I refine it.
29. As the user, I want to soft-delete a Recipe (hide from catalog, keep for history), so that archived Weeks stay legible.

### Cooking
30. As the user, I want to trigger a Cook from a Recipe/Ad-hoc-assigned Meal Slot, so that I log that I cooked the meal.
31. As the user, I want a pre-Cook confirmation sheet showing each ingredient's `current → new` and state transitions, so that I understand the impact before it lands.
32. As the user, I want warnings (not hard blocks) for Unavailable or insufficient Tracked ingredients, so that I can proceed if I choose (e.g., substituting).
33. As the user, I want shortfalls to clamp at zero (no negative quantities) on Cook, so that the ledger stays sane.
34. As the user, I want a Cook to add the Recipe's `servings` worth of portions to the Food Bank, so that I can eat them later.
35. As the user, I want a cooked Meal Slot marked done with one Cook per slot, so that I can't double-decrement.

### Food Bank
36. As the user, I want to see available Food Bank portions grouped by Recipe (e.g., "Chili ×2"), so that I know what leftovers I have.
37. As the user, I want a Meal Slot's Food Bank reservation to release when I clear the slot, so that availability stays accurate.
38. As the user, I want a Week's reservations to lock as permanent consumption when the Week archives, so that the Food Bank stays honest over time.
39. As the user, I want Food Bank withdrawals to have no effect on Ingredient Inventory, so that I don't double-count (ingredients were consumed at Cook time).

### Shopping List
40. As the user, I want a derived Shopping List of ingredients required by planned fresh Cooks that aren't fully available, so that I know what to buy.
41. As the user, I want Endless ingredients excluded from the Shopping List, so that it isn't cluttered with staples.
42. As the user, I want to check off a Shopping List item by entering the quantity bought, so that I restock Inventory as I shop.
43. As the user, I want the Shopping List to reflect plan changes live, so that it's never stale.

### Agent (chat)
44. As the user, I want to chat with the agent to plan my Week, so that I delegate meal planning.
45. As the user, I want to tell the agent "I bought 6 eggs" / "we finished the milk," so that it updates my Inventory as my data-entry proxy.
46. As the user, I want to ask the agent to add a Recipe or Ingredient, so that I delegate catalog entry.
47. As the user, I want the agent to use past Weeks and the Recipe catalog as planning context, so that it plans better than a blank slate.
48. As the user, I want to see the agent's tool calls stream inline as they happen, so that I trust its direct (ungated) execution.
49. As the user, I want to see my full chat scrollback, so that I can reference earlier conversation.
50. As the user, I want the agent structurally unable to trigger Cooks, edit/delete Recipes, or touch the DB directly, so that real-world inventory changes and catalog curation stay under my control.

### Cross-cutting
51. As the user, I want every write row to carry `created_by` (user | agent), so that I can audit who changed what.
52. As the user, I want the agent to handle unit conversion on entry ("2 chicken breasts" → grams), so that I speak naturally while the canonical-unit invariant is preserved.
53. As the user, I want the app structured as a bounded context (`src/cooking/`, `cooking_*` tables), so that future sibling life-purpose trackers can plug in without a refactor.

## Implementation Decisions

### Architecture & modules
- **Domain / service layer** — the single source of truth for all rules. Operations: `assign_slot`, `clear_slot`, `trigger_cook`, `reserve_portion`, `set_inventory`, `restock_ingredient`, `add_recipe`, `add_ingredient`, `derive_shopping_list`, `compute_availability`, `transition_inventory_state`. Both the UI and the agent tools call these — no rule lives in only one surface.
- **Agent** — a single reactive assistant built on the **Vercel AI SDK**, running server-side in a TanStack Start route handler under the user's Clerk session, streaming to the chat UI via `useChat`, with multi-step tool calling. Model: **OpenAI `gpt-5.6-luna`** via the SDK's provider abstraction (swappable as config).
- **UI** — TanStack Start + shadcn, four-surface bottom nav (`Schedule | Inventory | Recipes | Chat`), Schedule as home. PWA (installable, push-capable).
- **Auth** — Clerk; Clerk-issued JWT trusted by Supabase; RLS policies scope every row to the Clerk user ID. Single-user in v1.
- **Data** — Supabase (Postgres). All Cooking tables prefixed `cooking_*` in the default schema.

### Agent tools (the capability boundary — see ADR 0003, 0007)
Twelve tools, each a thin wrapper over a service-layer function:
- Schedule: `assign_slot(week, day, meal, assignment)` where `assignment` is a discriminated union `{recipe | adhoc | food_bank | no_cook}`; `clear_slot(week, day, meal)`.
- Catalog: `add_recipe(name, ingredients[], servings, notes?)`; `add_ingredient(name, unit)`.
- Inventory: `restock_ingredient(ingredient_id, quantity_added)` (additive); `set_ingredient_state(ingredient_id, state, quantity?)` (absolute / state change).
- Queries: `query_schedule(week)`; `query_inventory(filter?)`; `query_recipes(query?)`; `query_ingredients(query?)`; `query_food_bank()`; `query_past_weeks(weeks_back)`.

**Deliberately absent** (the autonomy boundary, enforced structurally): no `trigger_cook`, no `update_recipe`/`delete_recipe`, no direct DB/SQL tools, no `add_food_bank`/`restore_portion`. The model proposes tool calls; tools validate and execute. Writes execute directly on instruction (no proposal gate) — safety comes from tool validation + streaming visibility + Schedule's free mutability + `created_by` audit.

### Agent context
Per turn: a fresh state snapshot (current Week's Schedule + Inventory states/quantities + Food Bank portions) is injected alongside the **last ~5 turns** of conversation history from `cooking_chat_messages`. Tool results are authoritative within a turn. UI shows the full scrollback; only the model context is truncated.

### Domain rules (see ADRs 0001, 0002, 0006)
- **Plan ↔ Cook decoupled (ADR 0001).** Schedule mutations never touch Inventory. Only a Cook consumes.
- **Cook (ADR 0002).** Decrements each Tracked required ingredient by the recipe's quantity (Tracked → Unavailable at zero); Endless unaffected; Unavailable ingredients trigger a warning (not a block) and stay Unavailable (clamp, no negatives). Produces `servings` portions into the Food Bank. One Cook per slot; user-triggered only.
- **Food Bank (ADR 0002, 0006).** Tracked per Recipe, commingled across Cooks. Withdrawals are **reservations at plan time** (reduce availability; clear releases; Week archive locks as permanent consumption). No effect on Ingredient Inventory.
- **Available check.** Warn-only everywhere (no hard blocks). Plan-time soft flags; Cook-time warnings + clamp.

### Inventory states
Three states, derived from quantity: **Endless** (no quantity, never decremented), **Tracked** (quantity > 0, decremented on Cook), **Unavailable** (quantity 0 / marked out). Each Ingredient has a canonical unit; both Inventory and Recipes express quantity in that unit (agent handles conversion on entry).

### Schema (indicative shapes, all `cooking_*` prefixed)
- `cooking_ingredients(id, name, unit, created_by, created_at)`
- `cooking_inventory(ingredient_id, user_id, state, quantity)`
- `cooking_recipes(id, name, servings, notes, created_by, created_at, deleted_at)`
- `cooking_recipe_ingredients(recipe_id, ingredient_id, quantity)`
- `cooking_adhoc_recipes(id, slot_id, name, created_by)` + ingredient rows
- `cooking_meal_slots(id, user_id, week_start, day, meal_position, assignment_type, assignment_data, cooked_at)`
- `cooking_cooks(id, user_id, slot_id, source_type, source_id, portions_produced, created_at)` — append-only Cook log
- `cooking_food_bank` — derivable from `cooking_cooks` (produced) minus reservations in `cooking_meal_slots` minus archived-week consumption; may be materialized for read perf
- `cooking_chat_messages(id, user_id, role, content, created_at)`
- Every writable row carries `created_by ∈ {user, agent}`.

### UI structure (high level)
- **Schedule (home):** vertical Mon–Sun list, each day a row with Lunch + Dinner cells; auto-scroll to today; week switcher (current/next) + past-week picker (read-only); Food Bank portions strip at top; Shopping List as a slide-up drawer.
- **Slot interaction:** tap → bottom-sheet action menu (Assign Recipe / Ad-hoc / Reserve from Food Bank / No Cook / Cook / Edit / Clear, context-dependent). Recipe picker shows cookability badges.
- **Cook flow:** tap Cook → confirmation sheet with decrement table + warnings (no blocks) → Confirm executes → slot marked cooked ✓.
- **Inventory:** grouped by state (Tracked / Endless / Unavailable); tap → bottom sheet (Restock additive / set quantity absolute / state change / Mark out).
- **Recipes:** searchable list with cookability badges; detail view; add/edit form; soft-delete.
- **Chat:** message stream via `useChat`; inline tool-call status lines (expandable); text input.

## Testing Decisions

### What makes a good test here
A good test asserts **observable domain outcomes** (Inventory went Tracked → Unavailable; Food Bank holds N portions; Shopping List shows the gap; a Cook is blocked from re-running), not implementation details (which function called which). Tests should survive refactors of internal wiring as long as the domain behavior is unchanged.

### Seams (per the agreed testing strategy)
- **Primary seam — service layer.** Tests call domain operations against a **test Supabase instance** (schema-reset per test or per suite) and assert outcomes. This is where exhaustive coverage lives: Cook decrement math (including clamp and Endless-skip), Food Bank production + reservation + archive-lock, Shopping List derivation, availability computation, Inventory state transitions, Schedule decoupling (mutating a slot never changes Inventory), and the one-Cook-per-slot rule. Deterministic, fast.
- **Thin E2E layer (Playwright).** A small set of critical flows: Clerk login → plan a Week → Cook a meal → verify Inventory decremented and Food Bank populated. Smoke depth — validates the UI shells wire to the service layer, not exhaustive.
- **Agent tools at the tool boundary.** Mock the model; invoke each of the 12 tools directly with a mocked Clerk session; assert the tool calls the expected service function with the right arguments and returns a domain-shaped result. Also assert the **capability boundary** — that no `trigger_cook`/edit/delete/DB tool exists (a structural test of ADR 0003).

### Modules to be tested
- Service layer (exhaustive).
- Agent tools (boundary + wiring).
- Critical UI flows (E2E smoke).

### Prior art
None — this is a greenfield repo (`CONTEXT.md` + 7 ADRs only). The testing architecture is established here for the first time.

## Out of Scope

- **Multi-user / sharing** — single-user v1. RLS enables future multi-user/share-with-partner as a policy change.
- **Proactive agent behavior** — agent is reactive (instruction-driven) only; no autonomous suggestions or auto-mutations.
- **Slotless / non-meal Cooks** — snacks, breakfast, prep-cooking not tied to a Lunch/Dinner slot. (Manually adjust Inventory for those.)
- **Recipe metadata beyond notes** — no steps, source URL, tags, cuisine, image, prep time.
- **Provenance UI badges** — `created_by` is internal audit only; not surfaced as agent-vs-user badges.
- **Food Bank expiry / staleness** — portions persist until withdrawn or manually discarded.
- **Multi-context machinery** — no plugin registry, no `CONTEXT-MAP.md`, no per-context Postgres schemas, no agent-scoping across contexts. Deferred until the second context arrives (ADR 0004).
- **Conversation summarization / multi-thread chat** — single thread, simple last-5-turn truncation.
- **v1.1 niceties** — voice input, drag-to-reorder slots, contextual agent FAB overlay on non-Chat screens, restore-portion after Week archive.
- **Hard availability blocks** — rejected in favor of warn-only (per the available-check decision).

## Further Notes

- **Authoritative domain vocabulary** — `CONTEXT.md` (14 terms: Ingredient, Inventory, Endless, Tracked, Unavailable, Recipe, Ad-hoc Recipe, Schedule, Week, Meal Slot, No Cook, Cook, Food Bank, Shopping List). Use these terms verbatim in code and UI.
- **Architectural decisions** — 7 ADRs in `docs/adr/`:
  - 0001 — Plan and Cook are decoupled
  - 0002 — Food Bank for prepared portions
  - 0003 — Agent is reactive, instruction-driven (fixed read/write surface)
  - 0004 — Cooking structured as a bounded context; multi-context machinery deferred
  - 0005 — Clerk for auth, Supabase JWT for RLS
  - 0006 — Food Bank withdrawals are reservations at plan time
  - 0007 — Agent architecture (Vercel AI SDK, custom domain tools, direct execution)
- **Stack** — TypeScript, TanStack Start, shadcn, Supabase, Clerk, Vercel (PWA). Model: `gpt-5.6-luna` via Vercel AI SDK (`@ai-sdk/openai`), provider-abstracted.
- **Safety stance** — the autonomy boundary is structural (tool absence), never prompt-based. The model is never trusted with invariant enforcement; tools validate and execute.
- **Extensibility hook** — the `src/cooking/` + `cooking_*` structure is deliberate so the second context is an additive change, not a refactor (ADR 0004).
