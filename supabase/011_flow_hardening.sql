-- 011_flow_hardening.sql
-- Align brief_responses to campaigns.id (uuid), extend status vocabulary,
-- broaden user_earnings.status to include 'withdrawn', and seed briefs from
-- existing campaign_audience rows so the state machine has a canonical
-- per-(campaign, user) row from day one.

-- 1) Rebuild brief_responses with uuid campaign_id + FK + new statuses.
--    The legacy BIGINT table cannot be coerced in place because the app was
--    inserting Number(uuid) = NaN (no valid rows land there). We drop/recreate
--    and reseed from campaign_audience, which is the real source of "sent"
--    intent.
drop table if exists brief_responses cascade;

create table brief_responses (
  id bigserial primary key,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  user_google_sub text not null,
  status text not null default 'sent'
    check (status in ('sent', 'accepted', 'declined', 'live', 'completed')),
  ig_post_url text,
  accepted_at timestamptz,
  live_at timestamptz,
  completed_at timestamptz,
  paid_at timestamptz,
  payout_inr numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_google_sub)
);

create index if not exists idx_brief_responses_user
  on brief_responses (user_google_sub, status);

create index if not exists idx_brief_responses_campaign
  on brief_responses (campaign_id, status);

alter table brief_responses enable row level security;

drop policy if exists "Service role brief_responses" on brief_responses;
create policy "Service role brief_responses" on brief_responses
  for all using (true) with check (true);

-- 2) Seed one 'sent' row per (campaign, audience-user) pair. Idempotent via
--    the unique constraint.
insert into brief_responses (campaign_id, user_google_sub, status, created_at)
select ca.campaign_id, ca.user_google_sub, 'sent', now()
from campaign_audience ca
on conflict (campaign_id, user_google_sub) do nothing;

-- 3) Keep brief_responses in sync when new audience rows arrive.
create or replace function brief_responses_seed_from_audience()
returns trigger
language plpgsql
as $$
begin
  insert into brief_responses (campaign_id, user_google_sub, status, created_at)
  values (new.campaign_id, new.user_google_sub, 'sent', now())
  on conflict (campaign_id, user_google_sub) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_brief_responses_seed_from_audience on campaign_audience;
create trigger trg_brief_responses_seed_from_audience
after insert on campaign_audience
for each row execute function brief_responses_seed_from_audience();

-- 4) Broaden user_earnings.status to include 'withdrawn' (simulated payout
--    settlement sink). The prior check only allowed pending/available/paid.
alter table user_earnings
  drop constraint if exists user_earnings_status_check;
alter table user_earnings
  add constraint user_earnings_status_check
  check (status in ('pending', 'available', 'paid', 'withdrawn'));

-- 5) Helper index for settlement/withdraw queries.
create index if not exists idx_user_earnings_user_status
  on user_earnings (user_google_sub, status);

-- 6) Link brand_accounts (IG-session source) to brands (marketplace tenant)
--    so create-campaign can tie a campaign to the exact brand behind the
--    session, not just a name match.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'brand_accounts') then
    if not exists (
      select 1
      from information_schema.columns
      where table_name = 'brand_accounts' and column_name = 'brand_id'
    ) then
      execute 'alter table brand_accounts add column brand_id uuid references brands (id) on delete set null';
      execute 'create index if not exists idx_brand_accounts_brand_id on brand_accounts (brand_id)';
    end if;
  end if;
end$$;
