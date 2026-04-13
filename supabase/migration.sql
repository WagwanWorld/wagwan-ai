-- Wagwan AI: User Profiles table
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create table if not exists user_profiles (
  google_sub text primary key,
  email text,
  name text,
  profile_data jsonb not null default '{}',
  platform_tokens jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table user_profiles enable row level security;

drop policy if exists "Service role full access" on user_profiles;
create policy "Service role full access"
  on user_profiles for all
  using (true)
  with check (true);
