# ADR-0008: Ingredient Ledger enables Uncook

**Date:** 2026-07-22
**Status:** Accepted

## Context

Cook is the only operation that mutates Tracked inventory and the only one that
produces Food Bank portions (ADR-0001 / ADR-0002). A user may want to **undo a
Cook** — "I cooked this by mistake", or "the meal didn't work out, pull the
ingredients and leftovers back."

Reversal is blocked by the current model: `applyCookDecrement` mutates the
inventory `quantity` in place and **clamps at zero** (Tracked → Unavailable when
the quantity hits 0). That clamp is lossy. If a recipe needs 3 eggs and only 2
are on hand, inventory goes to 0 — and nothing records that the recipe *asked*
for 3 but only *consumed* 2. There is no way to know whether to restore 2 or 3.

Without a record of what actually changed, faithful reversal is impossible.

## Decision

Introduce an **append-only Ingredient Ledger** that records every quantity
change a Cook applies, and an **Uncook** operation that replays it in reverse.

### The ledger records the *actual* delta (post-clamp), not the recipe's request

A Cook of an egg recipe needing 3, with 2 on hand, records `delta = -2` (what
the inventory actually moved by), not `-3`. Uncook replays `+2`, restoring the
ingredient to exactly its pre-cook state. Logging the actual delta is what makes
reversal correct across:

- **Clamps** — only the consumed quantity is restored.
- **Multiple Cooks of the same ingredient** — each cook's ledger rows are
  independent; reversing one does not touch the other.
- **Manual edits after the Cook** — a restock or state change after the cook is
  not clobbered; Uncook adds back only the cook's delta.

### Lifecycle

- `Cook` appends one ledger row per Tracked ingredient it changed (Endless and
  Unavailable ingredients are never decremented, so they get no row).
- `Uncook` reads the slot's active (non-reversed) ledger rows, applies `+|delta|`
  to each ingredient (Unavailable → Tracked where quantity becomes positive),
  marks the rows `reversed`, reverses the Food Bank production, and releases the
  slot's cooked flag so it can be cooked again.

### Food Bank reversal is floored

A Cook banks `servings − 1` portions. Uncook reverses that many, but **floored at
`produced − reserved`** — it never breaks a promise a Food Bank slot is holding.
If portions were reserved after the cook, the banking reversal is partial and
the ingredient reversal still proceeds. (To fully reverse the banking, clear the
reservations first.)

### Not a full event-sourced model

Inventory `quantity` remains the live, mutable current state (fast reads, simple
writes). The ledger is an audit/reversal mechanism written alongside each Cook
decrement in the same logical step — it is **not** the source of truth from
which quantity is derived. A purer event-sourced model was considered and
deferred as heavier than this use case needs.

## Consequences

- **New table** `cooking_ingredient_ledger` (migration 0008) + an
  `IngredientLedgerRepo` seam, tested in-memory like the other repos.
- `cook()` gains a fifth dependency (the ledger repo) and writes a row per
  changed Tracked ingredient after each decrement.
- `uncook()` is a new domain operation (CONTEXT → Uncook), exposed via
  `schedule.uncook`. It is the deliberate inverse of Cook and the second thing
  (after Cook) that mutates Tracked inventory.
- **No transaction** wraps the decrement + ledger write (matching the existing
  non-transactional Cook loop). A failure between save and record would leave an
  unreversible decrement; accepted for a personal app.
- Bonus: the ledger is an audit trail ("when were these eggs used?") and could
  later drive derived views.

## Rejected alternatives

- **Mutable `produced`-style reversal with no ledger.** Can't restore inventory
  (clamp is lossy). Only covers Food Bank portions, not ingredients. Rejected.
- **Full event sourcing** (ledger as source of truth, quantity derived). Cleaner
  in principle but a large refactor of Inventory for marginal benefit here.
  Deferred.
- **Per-row Food Bank lineage** (tag each portion batch with its source cook).
  Would let Uncook reverse a specific batch, but the Food Bank is already a
  commingled counter (ADR-0002) and count-based reversal is sufficient. Rejected.
