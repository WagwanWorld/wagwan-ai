# Flow Hardening Runbook — 2026-04-23

Operational runbook for the brand → creator → payout hardening shipped in
the `end-to-end flow hardening` plan. Use this for first-time deploys,
developer demos, and rollback.

## 1. Apply the migration

Migration: `supabase/011_flow_hardening.sql`

```bash
# Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or pg connection) in .env
npm run supabase:migrate
```

What it does:

- Rebuilds `brief_responses` so `campaign_id` is a `uuid` with a foreign key
  to `campaigns(id) on delete cascade`.
- Extends the status check constraint to include `sent`, `live`, `completed`.
- Seeds one `brief_responses` row per existing `campaign_audience` entry.
- Adds a trigger so new `campaign_audience` inserts always create a matching
  `brief_responses (status='sent')`.
- Broadens `user_earnings.status` to include `'withdrawn'`.
- Adds `brand_accounts.brand_id` → `brands(id)` so tenants are resolvable
  without relying on free-text brand name.

> The migration drops and recreates `brief_responses`. That is safe today
> because the old rows were unusable (bigint `campaign_id` while campaign ids
> are UUIDs). If a future deploy has hand-curated rows, snapshot the table
> first.

## 2. Smoke the lifecycle end-to-end

Run locally (`npm run dev`) or in a preview deploy. Refresh between steps to
prove refresh parity.

1. Brand → `/brands/portal` → launch a campaign targeting at least one
   creator.
2. Creator → `/earn` → the card appears with a `New request` pill.
3. Creator clicks `Accept`. Brand portal `Requests` panel shows `Accepted`.
4. Brand clicks `Mark live`. Creator sees `Live` with a `Mark as posted` CTA.
5. Creator submits an Instagram URL. Brand portal shows `Completed` and a
   pending earnings row exists.
6. Hit simulated settlement (see below). Row flips to `available`.
7. Creator withdraws. Wallet shows the `Simulated payout` banner; rows
   become `withdrawn`.

## 3. Simulated settlement (dev/demo only)

`user_earnings.status = 'pending'` never flips on its own — in production
that is a real payments webhook. Locally, call:

```bash
curl -X POST https://<host>/api/user/wallet/settle \
  -H 'content-type: application/json' \
  -d '{"googleSub":"<sub>", "minAgeSeconds": 0}'
```

Response: `{ ok: true, simulated: true, updated: <n> }`.

Schedule it via cron if you want settlement to happen on a delay (set
`minAgeSeconds` to enforce a cooling period, e.g. `60` for demos).

## 4. Withdrawal (simulated)

```bash
curl -X POST https://<host>/api/user/wallet/withdraw \
  -H 'content-type: application/json' \
  -d '{"googleSub":"<sub>"}'
```

Response includes `simulated: true` and `withdrawn_inr`. The wallet UI shows
a `Simulated payout · ₹<amount> marked as withdrawn.` banner.

## 5. Guardrails

- Vitest specs:
  - `tests/flow-state-machine.test.ts` — transitions for briefs + earnings.
  - `tests/brief-response.api.test.ts` — `isCampaignUuid` regression guard.
- ESLint + Prettier enforced via Husky pre-commit + CI (`npm run validate`).
- The DB check constraints mirror `src/lib/server/flowState.ts` — keep them
  in sync or the tests will fail.

## 6. Rollback

Low-risk rollback (no real payments touched):

1. Revert the deploy (Vercel → previous deployment promote).
2. If you already ran `011_flow_hardening.sql`, you do **not** need to
   downgrade the schema: the new columns and wider check constraints are
   supersets of the old ones. The only destructive change is the rebuilt
   `brief_responses`; the previous rows were unusable, so nothing of value
   is lost.
3. If a downgrade is mandatory, restore a pre-migration snapshot from the
   Supabase project (Settings → Database → Backups).

## 7. Future work (out of scope for 2026-04-23)

- Real UPI payout provider wiring. The simulated endpoints are intentionally
  idempotent so swapping in a webhook should be a one-line change.
- Real-time campaign updates (currently the portal + earn pages refetch on
  user action instead of subscribing to Postgres changes).
- Deep-link `next=` handling for brand login (explicitly deferred).
