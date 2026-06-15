-- Table to store digitally signed agreements
create table if not exists signed_agreements (
  id uuid primary key default gen_random_uuid(),
  signer_name text not null,
  company_name text not null,
  signature_data text not null,
  agreement_type text not null default 'service_agreement_fuzone',
  signed_at timestamptz not null default now(),
  ip_address text,
  created_at timestamptz not null default now()
);

-- RLS
alter table signed_agreements enable row level security;

-- Only service role can insert/read (no public access)
drop policy if exists "Service role full access on signed_agreements" on signed_agreements;
create policy "Service role full access on signed_agreements"
  on signed_agreements
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
