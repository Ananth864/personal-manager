import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { UserButton } from '@clerk/tanstack-react-start'

import { BottomNav } from '../components/bottom-nav'
import { ThemeToggle } from '../components/theme-toggle'

// Route guards are UX, not security (per the TanStack Start auth architecture).
// The data boundary is Supabase RLS. This guard just keeps unauthenticated
// users out of the app surfaces, redirecting them to /sign-in.
const requireAuth = createServerFn().handler(async () => {
  const { userId } = await auth()
  if (!userId) {
    throw redirect({ to: '/sign-in' })
  }
  return { userId }
})

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => requireAuth(),
  component: AuthedLayout,
})

function AuthedLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <LinkBrand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

function LinkBrand() {
  return (
    <span className="font-display text-base font-semibold tracking-tight">
      Personal Manager
    </span>
  )
}
