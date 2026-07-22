-- 0010_chat_messages.sql
-- The cooking agent's conversation log (T08; ADR-0007). Each row is one UI
-- message (user or assistant), stored as the AI SDK's UIMessage `parts` JSONB.
-- RLS-scoped per user; the agent route handler loads the last ~5 turns for model
-- context and the chat UI loads the full scrollback on mount.

create table if not exists cooking_chat_messages (
  -- The AI SDK UIMessage id (client/SDK-generated string), used as the PK so
  -- reload reconstructs identical message ids.
  id          text primary key,
  user_id     text not null default auth.jwt() ->> 'sub',
  role        text not null check (role in ('user', 'assistant')),
  parts       jsonb not null,
  created_at  timestamptz not null default now()
);

alter table cooking_chat_messages enable row level security;

drop policy if exists "owner manages own cooking_chat_messages" on cooking_chat_messages;
create policy "owner manages own cooking_chat_messages" on cooking_chat_messages
  for all
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Newest-first/oldest-first scans for history loading.
create index if not exists cooking_chat_messages_user_created_idx
  on cooking_chat_messages (user_id, created_at);
