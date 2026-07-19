# Food Bank withdrawals are reservations at plan time, not a separate consume event

A Meal Slot assigned to a Food Bank portion *reserves* that portion at plan time, reducing availability. Clearing the slot releases the reservation. When a Week archives (becomes read-only), its reservations lock as permanent consumption. Cook remains the only operation that produces portions.

Rejected alternatives: (X) a separate user-triggered "eaten" event parallel to Cook — rejected because it adds a mark-eaten step to every leftover meal, which is friction the user will skip, causing the Food Bank to drift from reality. (Z) auto-consume at meal time — rejected as magic that breaks silently when the user didn't actually eat the planned leftover. Reservation (Y) is safe because the Food Bank is a derived ledger (portions originate from Cooks that already happened), not real-world state — so coupling it to planning does not violate the Plan/Cook decoupling (ADR 0001), which was specifically about Ingredient Inventory.

Edge case accepted: a reserved-but-un eaten portion is locked once its week archives. Rare for a personal app; a manual "restore portion" action can be added later if it bites.
