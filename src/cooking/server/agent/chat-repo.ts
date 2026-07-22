import { createCookingClient } from '../../lib/supabase'
import type { UIMessage } from 'ai'

interface RawRow {
  id: string
  role: 'user' | 'assistant'
  parts: unknown
  created_at: string
}

/**
 * Persistence for the cooking agent's conversation log (T08; ADR-0007). Each row
 * is one UI message stored as the AI SDK's `parts` JSONB. RLS scopes every query
 * to the caller; the chat UI loads the full scrollback on mount and saves each
 * new message after a turn. The streaming route handler does not touch this — it
 * works off the messages the client sends.
 */
export class SupabaseChatMessageRepo {
  private readonly client

  constructor(token: string) {
    this.client = createCookingClient(token)
  }

  async loadAll(): Promise<UIMessage[]> {
    const { data, error } = await this.client
      .from('cooking_chat_messages')
      .select('id, role, parts, created_at')
      .order('created_at', { ascending: true })
    if (error) {
      throw new Error(`Failed to load chat history: ${error.message}`)
    }
    return (data as RawRow[]).map((r) => ({
      id: r.id,
      role: r.role,
      parts: r.parts as UIMessage['parts'],
    }))
  }

  /** The most recent `limit` messages, in chronological order (oldest first). */
  async loadRecent(limit: number): Promise<UIMessage[]> {
    const { data, error } = await this.client
      .from('cooking_chat_messages')
      .select('id, role, parts, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      throw new Error(`Failed to load chat history: ${error.message}`)
    }
    return (data as RawRow[])
      .slice()
      .reverse()
      .map((r) => ({
        id: r.id,
        role: r.role,
        parts: r.parts as UIMessage['parts'],
      }))
  }

  async save(message: UIMessage): Promise<void> {
    const { error } = await this.client.from('cooking_chat_messages').upsert(
      {
        id: message.id,
        role: message.role,
        parts: message.parts,
      },
      { onConflict: 'id' },
    )
    if (error) {
      throw new Error(`Failed to save chat message: ${error.message}`)
    }
  }
}
