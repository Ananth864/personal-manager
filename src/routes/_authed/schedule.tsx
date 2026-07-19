import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/schedule')({
  component: SchedulePage,
})

function SchedulePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Schedule</h1>
      <p className="text-sm text-muted-foreground">
        Your weekly meal plan (Monday–Sunday, Lunch &amp; Dinner) lands here in
        a later ticket.
      </p>
    </div>
  )
}
