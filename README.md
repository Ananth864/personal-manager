# Personal Manager

A mobile-first PWA for managing the cooking context of your life — weekly meal scheduling, recipe catalog, ingredient inventory, and an agent that plans and updates on your behalf. Built as the first bounded context of a broader personal manager.

## Stack

- **Framework:** TanStack Start (file-based router, SSR, server functions) + React 19
- **UI:** shadcn (new-york) + Tailwind v4 + lucide icons
- **Auth:** Clerk (`@clerk/tanstack-react-start`) — SSR via `clerkMiddleware`
- **Data:** Supabase (Postgres) with Row-Level Security scoped to the Clerk user id
- **Hosting:** Netlify (`@netlify/vite-plugin-tanstack-start`)
- **Runtime/PM:** Bun

## Getting started

1. Install: `bun install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (Clerk dashboard → API keys)
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (optional in the skeleton; required once Inventory lands)
3. Wire Clerk↔Supabase RLS once: see `supabase/README.md`
4. Dev: `bun run dev`
5. Build: `bun run build` (produces the Netlify function in `.netlify/`)

## Project layout

- `CONTEXT.md` — ubiquitous domain language for the Cooking context (read this first)
- `docs/adr/` — architectural decisions
- `docs/specs/0001-cooking-v1.md` — v1 spec
- `src/cooking/` — the Cooking bounded context (service layer + infra)
- `src/routes/_authed/` — the four authenticated surfaces (Schedule, Inventory, Recipes, Chat)

## Status

Skeleton ticket (T01). The four-surface shell, Clerk auth, PWA installability, Supabase client + RLS scaffolding, and the `src/cooking/` structure are in place. Feature surfaces (Inventory, Recipes, Schedule, Cook, Food Bank, Shopping List, Agent) land in subsequent tickets — see issues #2–#10.
