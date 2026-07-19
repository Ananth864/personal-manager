import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/chat')({
  component: ChatPage,
})

function ChatPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Chat</h1>
      <p className="text-sm text-muted-foreground">
        The cooking agent — to plan your week, report purchases, and add
        recipes — lands here in a later ticket.
      </p>
    </div>
  )
}
