# Cooking is structured as a bounded context; multi-context machinery is deferred

Cooking lives under `src/cooking/` with its own domain model, routes, components, and `cooking_*`-prefixed tables in Supabase — even though it's the only context in v1. The shared shell is minimal: auth, nav, and a home route that renders the cooking schedule. No plugin registry, no per-context schemas, no cross-context seams, no agent-scoping decision. All deferred until a second context actually exists, at which point `CONTEXT.md` moves to `src/cooking/CONTEXT.md` and a root `CONTEXT-MAP.md` is added.

Rejected alternatives: (a) smear cooking into a generic `src/` — rejected because extracting it when context 2 arrives would be a refactor rather than a mechanical move. (b) build the full plugin architecture now — rejected as speculative complexity for a personal app with a small, knowable set of future contexts; better to decide schemas, registry, and agent scope with a real second context in hand.
