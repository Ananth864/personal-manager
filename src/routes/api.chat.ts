import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@clerk/tanstack-react-start/server'
import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream
  
} from 'ai'
import type {UIMessage} from 'ai';
import { z } from 'zod'
import { env } from '#/env'
import { SupabaseInventoryRepo } from '#/cooking/server/inventory/supabase-repo'
import { SupabaseScheduleRepo } from '#/cooking/server/schedule/supabase-repo'
import { SupabaseRecipeRepo } from '#/cooking/server/recipes/supabase-repo'
import { SupabaseFoodBankRepo } from '#/cooking/server/food-bank/supabase-repo'
import { foodBankSummaryFor } from '#/cooking/server/food-bank/service'
import { buildStateSnapshot, loadAgentWeek } from '#/cooking/server/agent/snapshot'
import { createAgentTools } from '#/cooking/server/agent/tools'
import { SupabaseChatMessageRepo } from '#/cooking/server/agent/chat-repo'
import { mondayOfWeek, todayISO } from '#/cooking/schedule/date-utils'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
const MODEL = env.OPENAI_MODEL ?? 'gpt-5.6-luna'

const AGENT_INSTRUCTIONS = `You are the cooking assistant for a personal meal-management app. You help the user plan weekly meals, track their ingredient inventory, and report purchases or usage.

You are reactive and instruction-driven: act only when the user addresses you, and write data only on instruction (never proactively). You report real-world state the user tells you (e.g. "I bought 6 eggs", "we finished the milk") — you do not invent inventory changes.

You can query and update Inventory via tools. You cannot cook meals, edit recipes, or access the database directly — if asked, explain the limit and suggest the user do it from the UI.

Below is the user's current state (fresh this turn). Use it to answer naturally, and call tools to make the changes the user requests, then confirm in a sentence.`

const HISTORY_TURNS = 5 // last ~5 turns of conversation injected as model context

async function handler({ request }: { request: Request }) {
  const session = await auth()
  if (!session.userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  const token = await session.getToken()
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()
  const parsed = z.object({ messages: z.array(z.any()) }).parse(body)
  const messages = parsed.messages as UIMessage[]

  const inventoryRepo = new SupabaseInventoryRepo(token)
  const scheduleRepo = new SupabaseScheduleRepo(token)
  const recipeRepo = new SupabaseRecipeRepo(token)
  const foodBankRepo = new SupabaseFoodBankRepo(token)

  // Fresh per-turn state snapshot (ADR-0007): current week + inventory + food bank.
  // The food-bank summary shares its loader with the tRPC procedure (one source).
  const weekStart = mondayOfWeek(todayISO())
  const [{ week, inventory }, foodBank, history] = await Promise.all([
    loadAgentWeek({ schedule: scheduleRepo, recipes: recipeRepo, inventory: inventoryRepo }, weekStart),
    foodBankSummaryFor(foodBankRepo, scheduleRepo, recipeRepo),
    // History is authoritative from the table (ADR-0007); the new user message
    // is taken from the client payload (not yet persisted).
    new SupabaseChatMessageRepo(token).loadRecent(HISTORY_TURNS * 2),
  ])
  const snapshot = buildStateSnapshot(week, inventory, foodBank)

  const newUserMessage = messages[messages.length - 1]
  const contextMessages =
    newUserMessage.role === 'user' ? [...history, newUserMessage] : history

  const result = streamText({
    model: openai(MODEL),
    instructions: `${AGENT_INSTRUCTIONS}\n\n${snapshot}`,
    messages: await convertToModelMessages(contextMessages),
    tools: createAgentTools({
      inventory: inventoryRepo,
      schedule: scheduleRepo,
      recipes: recipeRepo,
      foodBank: foodBankRepo,
    }),
    // Multi-step allows "plan my week": query, then batch-assign across the
    // current + next week (up to 28 slots), then confirm. The model makes many
    // tool calls per step, but a generous cap keeps a full plan from truncating.
    stopWhen: isStepCount(20),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: handler,
    },
  },
})
