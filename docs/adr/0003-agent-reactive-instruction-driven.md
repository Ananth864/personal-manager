# Agent model: reactive, instruction-driven, with a fixed read/write surface

The agent (LLM assistant) operates reactively: it acts only when the user addresses it, never proactively. It reads the full domain — current and past Schedules, the Recipe/Ingredient catalog, Inventory, and the Food Bank. On instruction it writes the Schedule (plan / swap / clear), the Recipe/Ingredient catalog (add), and Inventory (acting as a data-entry proxy for the user's reports, e.g. "I bought 300g chicken"). It does not trigger Cook events and does not write the Food Bank except indirectly through user-triggered Cooks.

Rejected alternatives: (a) fully autonomous agent — rejected because Inventory is real-world state only the user observes; autonomous writes would create drift between the system and the kitchen. (b) propose-and-approve for every action — rejected because it adds approval friction to low-risk, on-instruction requests (inventory data entry, schedule planning) that the user wants to feel hands-off. (c) agent read-only on Inventory — rejected because the user wants to report state *through* the agent rather than fill forms.

Cook events stay user-triggered so the only mutator of real-world inventory state remains a deliberate human action, preserving the integrity of the Inventory and Food Bank ledgers.
