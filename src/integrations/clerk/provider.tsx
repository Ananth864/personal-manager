import { ClerkProvider } from '@clerk/tanstack-react-start'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error('Add VITE_CLERK_PUBLISHABLE_KEY to the .env.local file')
}

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  )
}
