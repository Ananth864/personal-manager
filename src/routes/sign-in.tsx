import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Personal Manager</h1>
          <p className="text-sm text-muted-foreground">
            Plan meals, track your kitchen, cook with intent.
          </p>
        </div>
        <SignIn routing="hash" />
      </div>
    </div>
  )
}
