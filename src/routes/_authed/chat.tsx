import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport  } from 'ai'
import type {UIMessage} from 'ai';
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTRPC } from '#/integrations/trpc/react'
import { LoadingState, ErrorState } from '#/cooking/ui/shared-states'

export const Route = createFileRoute('/_authed/chat')({
  component: ChatPage,
})

function ChatPage() {
  const trpc = useTRPC()
  const historyQuery = useQuery(trpc.chat.list.queryOptions())

  if (historyQuery.isLoading) return <LoadingState />
  if (historyQuery.error) {
    return (
      <ErrorState
        title="Couldn't load your conversation"
        message={historyQuery.error.message}
        onRetry={() => historyQuery.refetch()}
      />
    )
  }

  return <ChatThread initialMessages={historyQuery.data ?? []} />
}

function ChatThread({ initialMessages }: { initialMessages: UIMessage[] }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')

  const transport = useRef(
    new DefaultChatTransport({ api: '/api/chat' }),
  ).current

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport,
    onError: (e) => console.error('chat error', e),
  })

  // Persist new messages once a turn finishes (status -> 'ready').
  const savedIds = useRef(new Set(initialMessages.map((m) => m.id)))
  const prevStatus = useRef(status)
  const saveMut = useMutation(
    trpc.chat.save.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.chat.list.queryKey() }),
    }),
  )
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready') {
      for (const m of messages) {
        if (m.role !== 'user' && m.role !== 'assistant') continue
        if (savedIds.current.has(m.id)) continue
        savedIds.current.add(m.id)
        saveMut.mutate({ id: m.id, role: m.role, parts: m.parts as never })
      }
    }
    prevStatus.current = status
  }, [status, messages, saveMut])

  // Auto-scroll to the latest message as it streams.
  const bottomRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  const busy = status === 'submitted' || status === 'streaming'

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-2xl flex-col">
      <header className="pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Tell the agent what you bought, finished, or want to plan.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="px-6 text-center text-sm text-muted-foreground">
              Say something like “I bought 6 eggs” or “what do I have?”
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error.message}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          const text = input.trim()
          if (!text || busy) return
          sendMessage({ text })
          setInput('')
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? 'Working…' : 'Message the cooking agent…'}
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border'
        }`}
      >
        {message.parts.map((part, i) => (
          <Part key={`${message.id}-${i}`} part={part} isUser={isUser} />
        ))}
      </div>
    </div>
  )
}

function Part({ part, isUser }: { part: UIMessage['parts'][number]; isUser: boolean }) {
  if (part.type === 'text') {
    return <p className="whitespace-pre-wrap break-words">{part.text}</p>
  }
  if (part.type.startsWith('tool-')) {
    return <ToolStatus part={part as ToolPart} dim={isUser} />
  }
  // Reasoning, source, file, etc. — not surfaced in v1.
  return null
}

interface ToolPart {
  type: string
  state?: 'input-streaming' | 'input-available' | 'output-available'
  input?: unknown
  output?: unknown
}

function ToolStatus({ part, dim }: { part: ToolPart; dim: boolean }) {
  const [open, setOpen] = useState(false)
  const toolName = part.type.replace(/^tool-/, '')
  const done = part.state === 'output-available'
  return (
    <div className={`text-xs ${dim ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2 py-0.5 font-medium hover:bg-black/10"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${done ? 'bg-primary' : 'bg-amber-500 animate-pulse'}`} />
        {toolName.replaceAll('_', ' ')}
        {done ? '' : '…'}
      </button>
      {open ? (
        <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-black/5 p-2 text-[11px] leading-snug">
          {JSON.stringify({ input: part.input, output: part.output }, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
