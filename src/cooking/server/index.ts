/**
 * The Cooking context's service layer.
 *
 * Later tickets add domain operations here — Inventory state transitions,
 * Recipe catalog, Schedule slot assignment, Cook decrement math, Food Bank
 * reservations, and Shopping List derivation. Both the tRPC procedures
 * (UI-facing, `src/integrations/trpc/router.ts`) and the agent tools
 * (`src/cooking/agent/*`, added in T08) call these functions, so the domain
 * rules live in exactly one place and are the primary test seam.
 *
 * Domain vocabulary lives in `CONTEXT.md`; architectural decisions in
 * `docs/adr/`; v1 scope in `docs/specs/0001-cooking-v1.md`.
 */
export {}
