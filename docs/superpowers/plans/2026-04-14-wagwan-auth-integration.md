# Wagwan Auth Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link wagwan-ai identity graphs to wagwan main platform users by accepting wagwan JWT tokens and adding a `wagwan_user_id` column, so identity/inference data is tied to real wagwan users.

**Architecture:** wagwan-ai gets a JWT verification module that validates wagwan's HS256 access tokens (signed with `WAGWAN_JWT_SECRET`). A new `wagwan_user_id` column on `user_profiles` links profiles to wagwan UUIDs. A middleware helper extracts the wagwan UUID from Bearer tokens. A new API endpoint lets the wagwan backend query identity data by wagwan user UUID. The existing `google_sub` PK is untouched — `wagwan_user_id` is an indexed nullable column for the link.

**Tech Stack:** SvelteKit, TypeScript, jsonwebtoken (HS256 JWT), Supabase PostgreSQL

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/server/wagwanAuth.ts` | JWT verification, user UUID extraction from Bearer tokens |
| Create | `supabase/007_wagwan_user_link.sql` | Add `wagwan_user_id` column + unique index to `user_profiles` |
| Modify | `src/lib/server/supabase.ts` | Add `linkWagwanUser()`, `getProfileByWagwanId()`, update `UserProfileRow` |
| Create | `src/routes/api/wagwan/link/+server.ts` | Endpoint: link a wagwan user to a wagwan-ai profile |
| Create | `src/routes/api/wagwan/identity/+server.ts` | Endpoint: get identity graph by wagwan user UUID |
| Create | `src/routes/api/wagwan/me/+server.ts` | Endpoint: get current user's identity via Bearer token |

---

### Task 1: Add JWT Verification Module

**Files:**
- Create: `src/lib/server/wagwanAuth.ts`

- [ ] **Step 1: Install jsonwebtoken package**

```bash
npm install jsonwebtoken && npm install -D @types/jsonwebtoken
```

- [ ] **Step 2: Create the wagwan auth module**

Create `src/lib/server/wagwanAuth.ts`:

```typescript
/**
 * Wagwan JWT token verification.
 *
 * Wagwan's Go backend signs access tokens with HS256 using the env var PUBLIC_KEY.
 * Token claims: { id: "<user-uuid>", ...RegisteredClaims }
 *
 * We read the same secret from WAGWAN_JWT_SECRET env var on the wagwan-ai side.
 */

import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

interface WagwanTokenClaims {
  /** Wagwan user UUID */
  id: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify a wagwan access token and return the user UUID.
 * Returns null if the token is invalid, expired, or the secret is not configured.
 */
export function verifyWagwanToken(token: string): string | null {
  const secret = env.WAGWAN_JWT_SECRET?.trim();
  if (!secret) {
    console.error('[WagwanAuth] WAGWAN_JWT_SECRET not configured');
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as WagwanTokenClaims;

    const userId = decoded.id?.trim();
    if (!userId) {
      console.error('[WagwanAuth] Token missing id claim');
      return null;
    }

    return userId;
  } catch (err) {
    console.error('[WagwanAuth] Token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Extract wagwan user UUID from a request's Authorization header.
 * Expects: `Authorization: Bearer <wagwan-access-token>`
 * Returns null if header is missing, malformed, or token is invalid.
 */
export function extractWagwanUserId(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  return verifyWagwanToken(token);
}

export function isWagwanAuthConfigured(): boolean {
  return !!(env.WAGWAN_JWT_SECRET?.trim());
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/wagwanAuth.ts package.json package-lock.json
git commit -m "feat(auth): add wagwan JWT verification module"
```

---

### Task 2: Add Database Migration for wagwan_user_id

**Files:**
- Create: `supabase/007_wagwan_user_link.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/007_wagwan_user_link.sql`:

```sql
-- Link wagwan-ai profiles to wagwan main platform users.
-- wagwan_user_id is the UUID from wagwan's users table.
-- Nullable because existing profiles were created before this link existed.

alter table user_profiles
  add column if not exists wagwan_user_id text;

-- Unique index: one wagwan user maps to one wagwan-ai profile
create unique index if not exists user_profiles_wagwan_user_id_idx
  on user_profiles (wagwan_user_id)
  where wagwan_user_id is not null;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/007_wagwan_user_link.sql
git commit -m "feat(db): add wagwan_user_id column to user_profiles"
```

---

### Task 3: Add Supabase Helpers for Wagwan User Linking

**Files:**
- Modify: `src/lib/server/supabase.ts`

- [ ] **Step 1: Add `wagwan_user_id` to `UserProfileRow`**

In `src/lib/server/supabase.ts`, add the field to the `UserProfileRow` interface (after `updated_at`):

```typescript
  wagwan_user_id: string | null;
```

- [ ] **Step 2: Add `linkWagwanUser` function**

Add at the end of `src/lib/server/supabase.ts`, before the closing `isSupabaseConfigured`:

```typescript
/**
 * Link a wagwan-ai profile to a wagwan main platform user.
 * Sets wagwan_user_id on the user_profiles row identified by google_sub.
 */
export async function linkWagwanUser(
  googleSub: string,
  wagwanUserId: string,
): Promise<boolean> {
  const { error } = await getClient()
    .from('user_profiles')
    .update({
      wagwan_user_id: wagwanUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('google_sub', googleSub);

  if (error) {
    console.error('[Supabase] linkWagwanUser error:', error.message);
    return false;
  }
  return true;
}

/**
 * Look up a wagwan-ai profile by wagwan main platform user UUID.
 * Returns null if no profile is linked to this wagwan user.
 */
export async function getProfileByWagwanId(
  wagwanUserId: string,
): Promise<UserProfileRow | null> {
  const { data, error } = await getClient()
    .from('user_profiles')
    .select('*')
    .eq('wagwan_user_id', wagwanUserId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] getProfileByWagwanId error:', error.message);
  }
  return data ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/supabase.ts
git commit -m "feat(supabase): add linkWagwanUser and getProfileByWagwanId helpers"
```

---

### Task 4: Create Link Endpoint

**Files:**
- Create: `src/routes/api/wagwan/link/+server.ts`

This endpoint lets a user link their wagwan-ai profile to their wagwan account. The user authenticates with their wagwan JWT and provides their wagwan-ai `google_sub`.

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/wagwan/link/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import {
  getProfile,
  getProfileByWagwanId,
  linkWagwanUser,
  isSupabaseConfigured,
} from '$lib/server/supabase';

/**
 * POST /api/wagwan/link
 *
 * Links a wagwan-ai profile to the authenticated wagwan user.
 *
 * Headers: Authorization: Bearer <wagwan-access-token>
 * Body: { "googleSub": "<wagwan-ai profile key>" }
 *
 * Returns: { ok: true, wagwanUserId, googleSub }
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  let body: { googleSub?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) {
    return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });
  }

  // Check the wagwan-ai profile exists
  const profile = await getProfile(googleSub);
  if (!profile) {
    return json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }

  // Check if this wagwan user is already linked to a different profile
  const existing = await getProfileByWagwanId(wagwanUserId);
  if (existing && existing.google_sub !== googleSub) {
    return json(
      { ok: false, error: 'wagwan_user_already_linked', linked_to: existing.google_sub },
      { status: 409 },
    );
  }

  // Link the profile
  const success = await linkWagwanUser(googleSub, wagwanUserId);
  if (!success) {
    return json({ ok: false, error: 'link_failed' }, { status: 500 });
  }

  return json({ ok: true, wagwanUserId, googleSub });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/wagwan/link/+server.ts
git commit -m "feat(api): add POST /api/wagwan/link to link wagwan user to profile"
```

---

### Task 5: Create Identity Query Endpoint

**Files:**
- Create: `src/routes/api/wagwan/identity/+server.ts`

This endpoint lets the wagwan backend query a user's identity graph by their wagwan UUID. Authenticated with wagwan JWT.

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/wagwan/identity/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, isSupabaseConfigured } from '$lib/server/supabase';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';

/**
 * GET /api/wagwan/identity?user_id=<wagwan-uuid>
 *
 * Returns identity graph and inference data for a wagwan user.
 * If user_id is omitted, returns data for the authenticated user.
 *
 * Headers: Authorization: Bearer <wagwan-access-token>
 */
export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const callerUserId = extractWagwanUserId(request);
  if (!callerUserId) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  const targetUserId = url.searchParams.get('user_id')?.trim() || callerUserId;

  const profile = await getProfileByWagwanId(targetUserId);
  if (!profile) {
    return json({ ok: false, error: 'user_not_linked' }, { status: 404 });
  }

  const graph = (profile.identity_graph ?? {}) as Record<string, unknown>;
  const inference = parseInferenceIdentityWrapper(graph.inferenceIdentity);

  return json({
    ok: true,
    wagwan_user_id: targetUserId,
    google_sub: profile.google_sub,
    name: profile.name,
    email: profile.email,
    identity_summary: profile.identity_summary,
    identity_graph: graph,
    inference: inference
      ? {
          revision: inference.revision,
          inferredAt: inference.inferredAt,
          current: inference.current,
        }
      : null,
    updated_at: profile.updated_at,
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/wagwan/identity/+server.ts
git commit -m "feat(api): add GET /api/wagwan/identity for querying user identity by wagwan UUID"
```

---

### Task 6: Create Authenticated "Me" Endpoint

**Files:**
- Create: `src/routes/api/wagwan/me/+server.ts`

Convenience endpoint: pass your wagwan JWT, get your identity graph back. No need to know your google_sub.

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/wagwan/me/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, isSupabaseConfigured } from '$lib/server/supabase';

/**
 * GET /api/wagwan/me
 *
 * Returns the linked wagwan-ai profile for the authenticated wagwan user.
 * Headers: Authorization: Bearer <wagwan-access-token>
 */
export const GET: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return json({
      ok: true,
      linked: false,
      wagwan_user_id: wagwanUserId,
      message: 'No wagwan-ai profile linked to this wagwan account yet',
    });
  }

  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;

  return json({
    ok: true,
    linked: true,
    wagwan_user_id: wagwanUserId,
    google_sub: profile.google_sub,
    name: profile.name,
    email: profile.email,
    platforms_connected: {
      google: Boolean(profileData.googleConnected),
      instagram: Boolean(profileData.instagramConnected),
      spotify: Boolean(profileData.spotifyConnected),
      linkedin: Boolean(profileData.linkedinConnected),
      apple_music: Boolean(profileData.appleMusicConnected),
    },
    identity_summary: profile.identity_summary,
    updated_at: profile.updated_at,
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/wagwan/me/+server.ts
git commit -m "feat(api): add GET /api/wagwan/me for authenticated identity lookup"
```

---

### Task 7: Smoke Test and Type Check

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript compiles**

```bash
cd /Users/madhviknemani/wagwan-ai && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Add WAGWAN_JWT_SECRET to .env**

Add to your `.env` file (use the same value as `PUBLIC_KEY` in wagwan's backend):

```
WAGWAN_JWT_SECRET=your_wagwan_public_key_here
```

- [ ] **Step 4: Run the migration**

Run `supabase/007_wagwan_user_link.sql` in the Supabase SQL Editor.

- [ ] **Step 5: Start dev server and test**

```bash
npm run dev
```

Test the endpoints:

```bash
# Link a profile (with a valid wagwan JWT)
curl -X POST http://localhost:5173/api/wagwan/link \
  -H "Authorization: Bearer <wagwan-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"googleSub": "<your-google-sub>"}'

# Check linked status
curl http://localhost:5173/api/wagwan/me \
  -H "Authorization: Bearer <wagwan-access-token>"

# Get full identity
curl http://localhost:5173/api/wagwan/identity \
  -H "Authorization: Bearer <wagwan-access-token>"
```

- [ ] **Step 6: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve integration issues from wagwan auth linking"
```
