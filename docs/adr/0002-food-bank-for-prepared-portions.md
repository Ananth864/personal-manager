# Food Bank tracks prepared portions separately from Ingredient Inventory

Cooking a Recipe or Ad-hoc Recipe produces `servings` worth of prepared food, which is added to a separate ledger called the Food Bank. A Meal Slot is filled either by a fresh Cook (consumes ingredients, adds to the Food Bank) or by withdrawing an existing portion from the Food Bank (no ingredient effect). Raw ingredients and prepared food are never mixed into one inventory.

Rejected alternatives: (a) no Food Bank — every meal cooks fresh, which double-decrements ingredients for batch cooking and makes the shopping list lie when one cook is meant to feed multiple slots; rejected because the user batch-cooks. (b) model prepared portions as pseudo-ingredients in the main Inventory — rejected because it conflates raw and prepared food, breaks "Cook is the only thing that mutates Tracked Inventory," and makes the shopping-list derivation ambiguous about whether a quantity is raw or cooked.
