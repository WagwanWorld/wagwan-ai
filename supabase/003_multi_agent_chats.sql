-- Multi-agent chats: one persistent thread per (google_sub, agent_type)
-- Run in Supabase SQL Editor after migration.sql and 002_identity_graph.sql

-- Chats (1 row per user per agent)
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null references user_profiles (google_sub) on delete cascade,
  agent_type text not null check (agent_type in (
    'gmail', 'instagram', 'calendar', 'twin', 'culture'
  )),
  title text not null default '',
  last_message_at timestamptz,
  unread_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (google_sub, agent_type)
);

create index if not exists chats_google_sub_last_at
  on chats (google_sub, last_message_at desc nulls last);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats (id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'agent', 'system')),
  content text not null default '',
  message_type text not null default 'text' check (message_type in (
    'text', 'card', 'insight', 'alert', 'recommendation', 'action'
  )),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_created
  on messages (chat_id, created_at desc);

-- Agent sync / proactive bookkeeping
create table if not exists agent_states (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null references user_profiles (google_sub) on delete cascade,
  agent_type text not null check (agent_type in (
    'gmail', 'instagram', 'calendar', 'twin', 'culture'
  )),
  last_synced_at timestamptz,
  context_summary text not null default '',
  extra jsonb not null default '{}',
  unique (google_sub, agent_type)
);

-- Scoped memory (global / per-integration)
create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null references user_profiles (google_sub) on delete cascade,
  scope text not null check (scope in ('global', 'gmail', 'instagram', 'calendar', 'twin', 'culture')),
  key text not null,
  value text not null default '',
  confidence real not null default 0.7,
  created_at timestamptz not null default now(),
  unique (google_sub, scope, key)
);

create index if not exists agent_memory_lookup
  on agent_memory (google_sub, scope);

alter table chats enable row level security;
alter table messages enable row level security;
alter table agent_states enable row level security;
alter table agent_memory enable row level security;

drop policy if exists "Service role full access chats" on chats;
create policy "Service role full access chats"
  on chats for all using (true) with check (true);

drop policy if exists "Service role full access messages" on messages;
create policy "Service role full access messages"
  on messages for all using (true) with check (true);

drop policy if exists "Service role full access agent_states" on agent_states;
create policy "Service role full access agent_states"
  on agent_states for all using (true) with check (true);

drop policy if exists "Service role full access agent_memory" on agent_memory;
create policy "Service role full access agent_memory"
  on agent_memory for all using (true) with check (true);
