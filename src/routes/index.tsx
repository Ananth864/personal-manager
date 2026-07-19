import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  // The app's home is the Schedule. /schedule sits under the _authed layout,
  // so unauthenticated users are redirected to /sign-in by that guard.
  beforeLoad: () => {
    throw redirect({ to: '/schedule' })
  },
})
