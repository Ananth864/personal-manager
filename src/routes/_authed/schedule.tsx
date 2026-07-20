import { createFileRoute } from '@tanstack/react-router'
import { SchedulePage } from '#/cooking/ui/schedule/schedule-page'

export const Route = createFileRoute('/_authed/schedule')({
  component: SchedulePage,
})
