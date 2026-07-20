import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

/** Shared list-page states for the Cooking surfaces (Inventory, Recipes, …). */

export function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-32 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      <Button onClick={onAction} className="mt-4">
        <Plus className="h-4 w-4" /> {actionLabel}
      </Button>
    </div>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry} variant="outline" className="mt-4">
        Try again
      </Button>
    </div>
  )
}
