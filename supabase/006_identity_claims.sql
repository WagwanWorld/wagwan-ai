-- Claim-level identity memory for semantic + structured retrieval (service-role access).
-- Run in Supabase SQL Editor after prior migrations.

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists user_identity_claims (
  id uuid primary key default gen_random_uuid(),
  user_google_sub text not null references user_profiles (google_sub) on delete cascade,
  assertion text not null,
  domain text,
  source text not null,
  confidence real,
  salience_0_100 integer,
  inference_revision integer,
  claim_kind text not null,
  content_fingerprint text not null,
  payload jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_google_sub, content_fingerprint)
);

create index if not exists user_identity_claims_user_domain_idx
  on user_identity_claims (user_google_sub, domain);

create index if not exists user_identity_claims_user_source_idx
  on user_identity_claims (user_google_sub, source);

create index if not exists user_identity_claims_user_revision_idx
  on user_identity_claims (user_google_sub, inference_revision desc);

create index if not exists user_identity_claims_assertion_trgm_idx
  on user_identity_claims using gin (assertion gin_trgm_ops);

-- Optional: after backfilling embeddings, add an ANN index in the SQL editor, e.g.
-- create index on user_identity_claims using hnsw (embedding vector_cosine_ops) where embedding is not null;

alter table user_identity_claims enable row level security;

-- Authenticated clients cannot read claim rows; server uses service role (bypasses RLS).

create or replace function match_identity_claims(
  p_user_google_sub text,
  query_embedding vector(1536),
  match_count int default 12
)
returns setof user_identity_claims
language sql
stable
as $$
  select *
  from user_identity_claims
  where user_google_sub = p_user_google_sub
    and embedding is not null
  order by embedding <=> query_embedding
  limit least(greatest(match_count, 1), 48);
$$;
