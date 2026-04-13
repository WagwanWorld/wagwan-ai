-- Append-only inference snapshots for longitudinal analysis (service-role writes).
-- Run after 004_marketplace_mvp.sql.

create table if not exists user_identity_inference_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_google_sub text not null references user_profiles (google_sub) on delete cascade,
  created_at timestamptz not null default now(),
  revision integer not null,
  source text not null default 'refresh-signals',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists user_identity_inference_snapshots_user_created
  on user_identity_inference_snapshots (user_google_sub, created_at desc);

alter table user_identity_inference_snapshots enable row level security;
