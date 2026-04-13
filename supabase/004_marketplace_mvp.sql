-- Attention marketplace MVP: brands, campaigns, audience, prefs, interactions, earnings.
-- Run after 003_multi_agent_chats.sql (or paste in SQL Editor in order).

-- Brands (MVP multi-tenant hook)
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands (id) on delete set null,
  brand_name text not null,
  title text not null,
  creative_text text not null default '',
  channels jsonb not null default '{"email": false, "in_app": true}'::jsonb,
  reward_inr numeric(12, 2) not null default 0,
  structured_query jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now()
);

create index if not exists campaigns_status_created
  on campaigns (status, created_at desc);

create table if not exists campaign_audience (
  campaign_id uuid not null references campaigns (id) on delete cascade,
  user_google_sub text not null,
  match_score numeric(8, 4) not null default 0,
  match_reason text not null default '',
  primary key (campaign_id, user_google_sub)
);

create index if not exists campaign_audience_user
  on campaign_audience (user_google_sub);

create table if not exists user_marketing_prefs (
  user_google_sub text primary key,
  channels jsonb not null default '{"email": true, "in_app": true, "whatsapp": false}'::jsonb,
  categories jsonb not null default '{}'::jsonb,
  max_campaigns_per_week int not null default 5,
  manual_interest_tags text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

create table if not exists campaign_interactions (
  id uuid primary key default gen_random_uuid(),
  user_google_sub text not null,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  action text not null check (action in ('view', 'save', 'dismiss', 'click')),
  created_at timestamptz not null default now()
);

create index if not exists campaign_interactions_user_created
  on campaign_interactions (user_google_sub, created_at desc);

create index if not exists campaign_interactions_campaign
  on campaign_interactions (campaign_id);

-- Simulated ledger (UPI withdraw later)
create table if not exists user_earnings (
  id uuid primary key default gen_random_uuid(),
  user_google_sub text not null,
  campaign_id uuid references campaigns (id) on delete set null,
  amount_inr numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'available', 'paid')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists user_earnings_user_created
  on user_earnings (user_google_sub, created_at desc);

alter table brands enable row level security;
alter table campaigns enable row level security;
alter table campaign_audience enable row level security;
alter table user_marketing_prefs enable row level security;
alter table campaign_interactions enable row level security;
alter table user_earnings enable row level security;

-- Server uses service role (bypasses RLS). Policies document intent for future anon keys.
drop policy if exists "Service role brands" on brands;
create policy "Service role brands" on brands for all using (true) with check (true);

drop policy if exists "Service role campaigns" on campaigns;
create policy "Service role campaigns" on campaigns for all using (true) with check (true);

drop policy if exists "Service role campaign_audience" on campaign_audience;
create policy "Service role campaign_audience" on campaign_audience for all using (true) with check (true);

drop policy if exists "Service role user_marketing_prefs" on user_marketing_prefs;
create policy "Service role user_marketing_prefs" on user_marketing_prefs for all using (true) with check (true);

drop policy if exists "Service role campaign_interactions" on campaign_interactions;
create policy "Service role campaign_interactions" on campaign_interactions for all using (true) with check (true);

drop policy if exists "Service role user_earnings" on user_earnings;
create policy "Service role user_earnings" on user_earnings for all using (true) with check (true);
