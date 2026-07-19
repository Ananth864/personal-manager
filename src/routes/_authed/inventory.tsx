import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/inventory')({
  component: InventoryPage,
})

function InventoryPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <p className="text-sm text-muted-foreground">
        Your kitchen — grouped by Tracked, Endless, and Unavailable — lands here
        in a later ticket.
      </p>
    </div>
  )
}
