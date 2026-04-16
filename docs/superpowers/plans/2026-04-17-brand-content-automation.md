# Brand Content Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build end-to-end Instagram content automation for brands: Instagram OAuth login (replacing password), GCS creative upload, AI-generated content plans (captions, hashtags, optimal scheduling), review/approve workflow, and cron-based auto-publishing via Instagram Content Publishing API.

**Architecture:** Brand authenticates via Instagram OAuth (separate from user IG auth). Creatives upload to Google Cloud Storage. AI analyzes creatives + brand insights to generate a posting plan. Approved posts enter a Supabase scheduling queue. A Vercel cron job polls the queue every 5 minutes and publishes via Instagram's 2-step container API. Everything lives in the existing brand portal as a new "Content Studio" tab.

**Tech Stack:** SvelteKit, Supabase (PostgreSQL), Google Cloud Storage (`@google-cloud/storage`), Instagram Graph API v25.0 (Content Publishing), Claude API (caption generation + vision), Vercel Cron Jobs.

---

## File Structure

**New files:**
- `src/lib/server/marketplace/brandInstagram.ts` — Brand IG OAuth helpers (auth URL, token exchange, token refresh, profile fetch)
- `src/lib/server/marketplace/gcsUpload.ts` — Google Cloud Storage upload utility
- `src/lib/server/marketplace/instagramPublisher.ts` — Instagram Content Publishing API (create container, poll status, publish)
- `src/lib/server/marketplace/contentPlanGenerator.ts` — AI content plan generation (Claude + insights + vision)
- `src/routes/auth/brand-instagram/+server.ts` — Brand IG OAuth initiation
- `src/routes/auth/brand-instagram/callback/+server.ts` — Brand IG OAuth callback
- `src/routes/api/brand/upload/+server.ts` — GCS file upload endpoint
- `src/routes/api/brand/generate-plan/+server.ts` — AI content plan generation endpoint
- `src/routes/api/brand/schedule/+server.ts` — Save/approve scheduled posts
- `src/routes/api/brand/scheduled-posts/+server.ts` — List scheduled/published posts
- `src/routes/api/brand/insights/+server.ts` — Fetch & cache brand IG insights
- `src/routes/api/cron/publish-scheduled/+server.ts` — Cron job to publish due posts
- `src/lib/components/brands/ContentStudio.svelte` — Content Studio tab UI
- `src/lib/components/brands/UploadZone.svelte` — Drag & drop file upload
- `src/lib/components/brands/ContentPlanView.svelte` — Timeline of scheduled posts with inline editing
- `src/lib/components/brands/PostCard.svelte` — Single post card (thumbnail, caption, time, status)
- `supabase/migrations/20260417000000_brand_content_automation.sql` — Schema for brand_accounts, scheduled_posts, etc.

**Modified files:**
- `src/routes/brands/login/+page.svelte` — Replace password form with "Connect with Instagram" button
- `src/routes/brands/portal/+page.svelte` — Add Content Studio tab toggle, integrate ContentStudio component
- `src/routes/brands/portal/+page.server.ts` — Load brand account data from Supabase alongside session check
- `src/lib/server/marketplace/brandSession.ts` — Extend to store `ig_user_id` in cookie payload
- `src/lib/server/marketplace/brandAuth.ts` — Update to validate brand session with `ig_user_id`
- `src/routes/api/brands/login/+server.ts` — Replace password login with IG OAuth redirect (or keep as fallback)
- `package.json` — Add `@google-cloud/storage` dependency
- `vercel.json` — Add cron job configuration

---

### Task 1: Supabase Migration — Brand Content Tables

**Files:**
- Create: `supabase/migrations/20260417000000_brand_content_automation.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Brand accounts (Instagram-authenticated brands)
CREATE TABLE IF NOT EXISTS brand_accounts (
  ig_user_id    TEXT PRIMARY KEY,
  ig_username   TEXT NOT NULL,
  ig_name       TEXT DEFAULT '',
  ig_profile_picture TEXT DEFAULT '',
  ig_followers_count INTEGER DEFAULT 0,
  ig_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ DEFAULT now()
);

-- Scheduled posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  gcs_url       TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('IMAGE','VIDEO','CAROUSEL','REELS','STORIES')),
  caption       TEXT DEFAULT '',
  hashtags      TEXT[] DEFAULT '{}',
  alt_text      TEXT DEFAULT '',
  scheduled_at  TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','publishing','published','failed')),
  ig_media_id   TEXT,
  ig_permalink  TEXT,
  ig_container_id TEXT,
  error_message TEXT,
  ai_reasoning  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sp_brand ON scheduled_posts(brand_ig_id, status);
CREATE INDEX idx_sp_schedule ON scheduled_posts(status, scheduled_at) WHERE status = 'scheduled';

-- Carousel items
CREATE TABLE IF NOT EXISTS scheduled_post_carousel_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  gcs_url   TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE','VIDEO')),
  position  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_spci_post ON scheduled_post_carousel_items(post_id);

-- Brand insights cache (accumulates over time)
CREATE TABLE IF NOT EXISTS brand_insights_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  insights_data JSONB NOT NULL DEFAULT '{}',
  fetched_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_bic_brand ON brand_insights_cache(brand_ig_id, fetched_at DESC);

-- RLS
ALTER TABLE brand_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_post_carousel_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_insights_cache ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260417000000_brand_content_automation.sql
git commit -m "feat: add brand_accounts, scheduled_posts, and insights_cache tables"
```

---

### Task 2: Brand Session — Store ig_user_id in Cookie

**Files:**
- Modify: `src/lib/server/marketplace/brandSession.ts`

- [ ] **Step 1: Update mintBrandSessionCookieValue to accept ig_user_id**

Replace the full file content:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE_SECRET } from '$env/static/private';

export const BRAND_SESSION_COOKIE = 'wagwan_brand_session';

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function signPayload(payload: string): string {
  return createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
}

/** Mint a session cookie that embeds the brand's IG user ID. */
export function mintBrandSessionCookieValue(igUserId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `v2:${igUserId}:${exp}`;
  const sig = signPayload(payload);
  return `${payload}:${sig}`;
}

/** Verify cookie and return the ig_user_id if valid, null otherwise. */
export function verifyBrandSessionCookieValue(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const lastColon = raw.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const payload = raw.slice(0, lastColon);
  const sig = raw.slice(lastColon + 1);

  // Support v2 (with ig_user_id) and v1 (legacy, no ig_user_id)
  if (payload.startsWith('v2:')) {
    const parts = payload.split(':');
    if (parts.length !== 3) return null;
    const igUserId = parts[1];
    const exp = parseInt(parts[2], 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    const expected = signPayload(payload);
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return igUserId;
  }

  // Legacy v1 (no ig_user_id)
  if (payload.startsWith('v1:')) {
    const exp = parseInt(payload.slice(3), 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false as unknown as null;
    const expected = signPayload(payload);
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return '__legacy__';
  }

  return null;
}

export function getBrandSessionFromRequest(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    if (k !== BRAND_SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return;
}

export { MAX_AGE_SEC as BRAND_SESSION_MAX_AGE_SEC };
```

- [ ] **Step 2: Update brandAuth.ts to use new return type**

Replace `src/lib/server/marketplace/brandAuth.ts`:

```typescript
import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getBrandSessionFromRequest, verifyBrandSessionCookieValue } from './brandSession';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Assert brand access. Returns the brand's ig_user_id if authenticated via IG session.
 * Falls back to X-Brand-Key header or allowlisted google_sub for legacy/API access.
 */
export function assertBrandAccess(request: Request, bodyGoogleSub?: string | null): string | null {
  const secret = (env.BRAND_PORTAL_SECRET ?? '').trim();
  const allowRaw = (env.BRAND_ALLOWLIST_GOOGLE_SUBS ?? '').trim();
  const allow = allowRaw
    ? allowRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Check IG session cookie (v2 with ig_user_id)
  const sessionRaw = getBrandSessionFromRequest(request);
  const igUserId = verifyBrandSessionCookieValue(sessionRaw);
  if (igUserId && igUserId !== '__legacy__') {
    return igUserId;
  }
  // Legacy v1 session (password-based)
  if (igUserId === '__legacy__') {
    return null;
  }

  // X-Brand-Key header fallback
  const headerKey = request.headers.get('x-brand-key')?.trim() ?? '';
  if (secret && headerKey && safeEqual(headerKey, secret)) {
    return null;
  }

  // Allowlisted google_sub fallback
  const sub = (bodyGoogleSub ?? '').trim();
  if (sub && allow.length && allow.includes(sub)) {
    return null;
  }

  if (!secret && !allow.length) {
    throw error(503, 'Brand portal not configured');
  }

  throw error(401, 'Brand access denied');
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/marketplace/brandSession.ts src/lib/server/marketplace/brandAuth.ts
git commit -m "feat: embed ig_user_id in brand session cookie (v2 format, v1 backward compat)"
```

---

### Task 3: Brand Instagram OAuth

**Files:**
- Create: `src/lib/server/marketplace/brandInstagram.ts`
- Create: `src/routes/auth/brand-instagram/+server.ts`
- Create: `src/routes/auth/brand-instagram/callback/+server.ts`

- [ ] **Step 1: Create brandInstagram.ts**

```typescript
import { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';

const BRAND_REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/brand-instagram/callback`;
const BRAND_SCOPES = 'instagram_business_basic,instagram_business_content_publish,instagram_manage_insights,instagram_manage_comments';

export function getBrandInstagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: BRAND_REDIRECT_URI,
    response_type: 'code',
    scope: BRAND_SCOPES,
    state,
  });
  return `https://api.instagram.com/oauth/authorize?${params}`;
}

export async function exchangeBrandCodeForToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: BRAND_REDIRECT_URI,
    code,
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`IG token exchange failed (${res.status}): ${txt}`);
  }
  const data = await res.json();
  const shortToken = data.access_token;

  // Exchange for long-lived token (60 days)
  const llRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortToken}`,
  );
  if (!llRes.ok) {
    return shortToken; // fallback to short-lived
  }
  const llData = await llRes.json();
  return llData.access_token ?? shortToken;
}

export async function refreshBrandToken(token: string): Promise<{ token: string; expiresAt: Date }> {
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
  );
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 5184000) * 1000);
  return { token: data.access_token, expiresAt };
}

export interface BrandIgProfile {
  id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  followers_count: number;
}

export async function fetchBrandProfile(token: string): Promise<BrandIgProfile> {
  const res = await fetch(
    `https://graph.instagram.com/v25.0/me?fields=id,username,name,profile_picture_url,followers_count&access_token=${token}`,
  );
  if (!res.ok) throw new Error('Failed to fetch brand profile');
  return res.json();
}
```

- [ ] **Step 2: Create auth initiation route**

Create `src/routes/auth/brand-instagram/+server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrandInstagramAuthUrl } from '$lib/server/marketplace/brandInstagram';
import { INSTAGRAM_APP_ID } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ cookies }) => {
  if (!INSTAGRAM_APP_ID?.trim()) {
    throw redirect(302, '/brands/login?error=not_configured');
  }
  const state = crypto.randomUUID();
  cookies.set('brand_ig_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    secure: cookieSecure,
  });
  throw redirect(302, getBrandInstagramAuthUrl(state));
};
```

- [ ] **Step 3: Create auth callback route**

Create `src/routes/auth/brand-instagram/callback/+server.ts`:

```typescript
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  exchangeBrandCodeForToken,
  fetchBrandProfile,
} from '$lib/server/marketplace/brandInstagram';
import {
  BRAND_SESSION_COOKIE,
  BRAND_SESSION_MAX_AGE_SEC,
  mintBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';
import { PUBLIC_BASE_URL } from '$env/static/public';
import pg from 'pg';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  const savedState = cookies.get('brand_ig_oauth_state');
  cookies.delete('brand_ig_oauth_state', { path: '/' });

  if (err) throw redirect(302, `/brands/login?error=${encodeURIComponent(err)}`);
  if (!code || !state || state !== savedState) {
    throw error(400, 'Invalid OAuth state');
  }

  try {
    const token = await exchangeBrandCodeForToken(code);
    const profile = await fetchBrandProfile(token);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    // Upsert into brand_accounts
    const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });
    try {
      await pool.query(
        `INSERT INTO brand_accounts (ig_user_id, ig_username, ig_name, ig_profile_picture, ig_followers_count, ig_access_token, token_expires_at, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (ig_user_id) DO UPDATE SET
           ig_username = EXCLUDED.ig_username,
           ig_name = EXCLUDED.ig_name,
           ig_profile_picture = EXCLUDED.ig_profile_picture,
           ig_followers_count = EXCLUDED.ig_followers_count,
           ig_access_token = EXCLUDED.ig_access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           last_login_at = now()`,
        [profile.id, profile.username, profile.name || '', profile.profile_picture_url || '', profile.followers_count || 0, token, expiresAt],
      );
    } finally {
      await pool.end();
    }

    // Set session cookie with ig_user_id
    const sessionValue = mintBrandSessionCookieValue(profile.id);
    cookies.set(BRAND_SESSION_COOKIE, sessionValue, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      maxAge: BRAND_SESSION_MAX_AGE_SEC,
    });

    throw redirect(302, '/brands/portal');
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'location' in e) throw e;
    console.error('[Brand IG Callback]', e);
    throw redirect(302, `/brands/login?error=auth_failed`);
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/marketplace/brandInstagram.ts src/routes/auth/brand-instagram/
git commit -m "feat: brand Instagram OAuth flow with long-lived token and Supabase upsert"
```

---

### Task 4: Update Brand Login Page — Instagram Button

**Files:**
- Modify: `src/routes/brands/login/+page.svelte`

- [ ] **Step 1: Replace password form with Instagram connect**

Replace the full file:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';

  $: errorMsg = $page.url.searchParams.get('error') || '';
</script>

<div class="login-page">
  <div class="login-bg" aria-hidden="true"></div>

  <div class="login-card">
    <p class="overline">Brand Portal</p>
    <h1 class="title">Connect your Instagram</h1>
    <p class="description">
      Sign in with your brand's Instagram account to start scheduling posts, generating captions, and automating your content.
    </p>

    {#if errorMsg}
      <p class="error">{errorMsg === 'not_configured' ? 'Instagram not configured on this server.' : `Authentication failed: ${errorMsg}`}</p>
    {/if}

    <a href="/auth/brand-instagram" class="ig-btn">
      <InstagramLogo size={20} weight="bold" />
      Continue with Instagram
    </a>

    <div class="footer-links">
      <a href="/brands" class="footer-link">&larr; Brand home</a>
      <span class="footer-sep">&middot;</span>
      <a href="/" class="footer-link">Creator app</a>
    </div>
  </div>
</div>

<style>
  .login-page {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 56px);
    padding: 2rem 1rem;
  }

  .login-bg {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse 70% 45% at 50% 0%, rgba(77, 124, 255, 0.06), transparent 70%);
  }

  .login-card {
    position: relative; z-index: 1; width: 100%; max-width: 26rem;
    padding: 2rem; border-radius: 1.25rem;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--glass-light, rgba(255, 255, 255, 0.055));
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0, 0, 0, 0.4);
  }

  .overline {
    font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.24em; color: var(--text-muted, #6d7684); margin: 0;
  }
  .title {
    margin: 0.75rem 0 0; font-size: 1.5rem; font-weight: 600;
    color: var(--text-primary, #e8ecf3);
  }
  .description {
    margin-top: 0.5rem; font-size: 0.875rem; line-height: 1.6;
    color: var(--text-muted, #6d7684);
  }
  .error {
    margin-top: 1rem; font-size: 0.875rem;
    color: var(--state-error, var(--accent-primary, #FF4D4D));
  }

  .ig-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.625rem;
    width: 100%; margin-top: 2rem; padding: 0.875rem;
    border: none; border-radius: 0.75rem;
    font-size: 0.9375rem; font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: #fff; text-decoration: none;
    background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4);
    cursor: pointer; transition: all 0.25s;
  }
  .ig-btn:hover {
    box-shadow: 0 0 32px rgba(221, 42, 123, 0.3);
    transform: translateY(-1px);
  }

  .footer-links {
    margin-top: 2rem; text-align: center; font-size: 0.75rem;
  }
  .footer-link {
    color: var(--text-muted, #6d7684); text-decoration: none; transition: color 0.2s;
  }
  .footer-link:hover { color: var(--text-primary, #e8ecf3); }
  .footer-sep { margin: 0 0.5rem; color: var(--border-strong, rgba(255, 255, 255, 0.14)); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/brands/login/+page.svelte
git commit -m "feat: replace brand password login with Instagram OAuth button"
```

---

### Task 5: Install GCS Package & Create Upload Utility

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/lib/server/marketplace/gcsUpload.ts`

- [ ] **Step 1: Install @google-cloud/storage**

Run: `npm install @google-cloud/storage`

- [ ] **Step 2: Create gcsUpload.ts**

```typescript
import { Storage } from '@google-cloud/storage';
import { env } from '$env/dynamic/private';

function getStorage(): Storage {
  const keyJson = env.GCS_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GCS_SERVICE_ACCOUNT_KEY not configured');
  const credentials = JSON.parse(keyJson);
  return new Storage({ credentials, projectId: credentials.project_id });
}

const BUCKET_NAME = 'wagwan-ai';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;   // 8MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];

export interface UploadResult {
  url: string;
  gcsPath: string;
  mediaType: 'IMAGE' | 'VIDEO';
  size: number;
}

export async function uploadCreativeToGCS(
  file: File,
  brandIgId: string,
): Promise<UploadResult> {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    throw new Error(`Unsupported file type: ${file.type}. Use JPEG for images or MP4 for video.`);
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${maxSize / 1024 / 1024}MB.`);
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const gcsPath = `brands/${brandIgId}/${timestamp}-${safeName}`;

  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);
  const blob = bucket.file(gcsPath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await blob.save(buffer, {
    contentType: file.type,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });

  // Make publicly readable
  await blob.makePublic();
  const url = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;

  return {
    url,
    gcsPath,
    mediaType: isImage ? 'IMAGE' : 'VIDEO',
    size: file.size,
  };
}
```

- [ ] **Step 3: Create upload API endpoint**

Create `src/routes/api/brand/upload/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) throw error(400, 'No files provided');
  if (files.length > 10) throw error(400, 'Max 10 files per upload');

  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      const result = await uploadCreativeToGCS(file, igUserId);
      results.push(result);
    } catch (e) {
      errors.push({ file: file.name, error: e instanceof Error ? e.message : 'Upload failed' });
    }
  }

  return json({ ok: true, uploads: results, errors });
};
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/server/marketplace/gcsUpload.ts src/routes/api/brand/upload/
git commit -m "feat: GCS creative upload with size/type validation and brand auth"
```

---

### Task 6: Instagram Content Publishing API

**Files:**
- Create: `src/lib/server/marketplace/instagramPublisher.ts`

- [ ] **Step 1: Create the publisher module**

```typescript
const IG_API = 'https://graph.instagram.com/v25.0';

export interface PublishResult {
  success: boolean;
  igMediaId?: string;
  permalink?: string;
  error?: string;
}

/** Create a media container for a single image. */
export async function createImageContainer(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string,
  altText?: string,
): Promise<string> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    caption,
    access_token: token,
  };
  if (altText) params.alt_text = altText;

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Container creation failed');
  return data.id;
}

/** Create a media container for a video (feed post or reel). */
export async function createVideoContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string,
  mediaType: 'VIDEO' | 'REELS',
): Promise<string> {
  const params: Record<string, string> = {
    video_url: videoUrl,
    caption,
    media_type: mediaType,
    access_token: token,
  };

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Container creation failed');
  return data.id;
}

/** Create a story container. */
export async function createStoryContainer(
  igUserId: string,
  token: string,
  mediaUrl: string,
  isVideo: boolean,
): Promise<string> {
  const params: Record<string, string> = {
    media_type: 'STORIES',
    access_token: token,
  };
  if (isVideo) {
    params.video_url = mediaUrl;
  } else {
    params.image_url = mediaUrl;
  }

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Story container failed');
  return data.id;
}

/** Create carousel: first create child containers, then the parent. */
export async function createCarouselContainer(
  igUserId: string,
  token: string,
  items: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }>,
  caption: string,
): Promise<string> {
  // Create child containers
  const childIds: string[] = [];
  for (const item of items) {
    const params: Record<string, string> = {
      is_carousel_item: 'true',
      access_token: token,
    };
    if (item.mediaType === 'IMAGE') {
      params.image_url = item.url;
    } else {
      params.video_url = item.url;
      params.media_type = 'VIDEO';
    }

    const res = await fetch(`${IG_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const data = await res.json();
    if (!res.ok || !data.id) throw new Error(data.error?.message || `Carousel item failed`);
    childIds.push(data.id);
  }

  // Wait for video items to be ready
  for (const childId of childIds) {
    await waitForContainer(childId, token);
  }

  // Create parent carousel container
  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'CAROUSEL',
      caption,
      children: childIds.join(','),
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Carousel container failed');
  return data.id;
}

/** Poll container status until FINISHED or error. Max 5 min. */
export async function waitForContainer(containerId: string, token: string): Promise<void> {
  const maxAttempts = 30; // 30 * 10s = 5 min
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code&access_token=${token}`,
    );
    const data = await res.json();
    const status = data.status_code;
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Container ${containerId} status: ${status}`);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error(`Container ${containerId} timed out after 5 minutes`);
}

/** Publish a ready container. */
export async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<{ igMediaId: string }> {
  const res = await fetch(`${IG_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Publish failed');
  return { igMediaId: data.id };
}

/** Fetch permalink for a published post. */
export async function fetchPermalink(mediaId: string, token: string): Promise<string> {
  const res = await fetch(
    `${IG_API}/${mediaId}?fields=permalink&access_token=${token}`,
  );
  const data = await res.json();
  return data.permalink || '';
}

/** Full publish flow: create container → wait → publish → get permalink. */
export async function publishPost(
  igUserId: string,
  token: string,
  post: {
    gcsUrl: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';
    caption: string;
    altText?: string;
    carouselItems?: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }>;
  },
): Promise<PublishResult> {
  try {
    let containerId: string;

    switch (post.mediaType) {
      case 'IMAGE':
        containerId = await createImageContainer(igUserId, token, post.gcsUrl, post.caption, post.altText);
        break;
      case 'VIDEO':
        containerId = await createVideoContainer(igUserId, token, post.gcsUrl, post.caption, 'VIDEO');
        break;
      case 'REELS':
        containerId = await createVideoContainer(igUserId, token, post.gcsUrl, post.caption, 'REELS');
        break;
      case 'STORIES':
        containerId = await createStoryContainer(igUserId, token, post.gcsUrl, post.gcsUrl.endsWith('.mp4'));
        break;
      case 'CAROUSEL':
        if (!post.carouselItems?.length) throw new Error('Carousel requires items');
        containerId = await createCarouselContainer(igUserId, token, post.carouselItems, post.caption);
        break;
      default:
        throw new Error(`Unsupported media type: ${post.mediaType}`);
    }

    await waitForContainer(containerId, token);
    const { igMediaId } = await publishContainer(igUserId, token, containerId);
    const permalink = await fetchPermalink(igMediaId, token);

    return { success: true, igMediaId, permalink };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/marketplace/instagramPublisher.ts
git commit -m "feat: Instagram Content Publishing API — containers, polling, carousel, stories, reels"
```

---

### Task 7: Cron Job — Publish Scheduled Posts

**Files:**
- Create: `src/routes/api/cron/publish-scheduled/+server.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { publishPost } from '$lib/server/marketplace/instagramPublisher';
import pg from 'pg';

export const GET: RequestHandler = async ({ request }) => {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    // Find posts due for publishing
    const { rows: duePosts } = await pool.query(
      `SELECT sp.*, ba.ig_access_token
       FROM scheduled_posts sp
       JOIN brand_accounts ba ON ba.ig_user_id = sp.brand_ig_id
       WHERE sp.status = 'scheduled'
         AND sp.scheduled_at <= now()
       ORDER BY sp.scheduled_at ASC
       LIMIT 5`,
    );

    const results = [];

    for (const post of duePosts) {
      // Mark as publishing
      await pool.query(`UPDATE scheduled_posts SET status = 'publishing' WHERE id = $1`, [post.id]);

      // Fetch carousel items if needed
      let carouselItems;
      if (post.media_type === 'CAROUSEL') {
        const { rows } = await pool.query(
          `SELECT gcs_url, media_type FROM scheduled_post_carousel_items WHERE post_id = $1 ORDER BY position`,
          [post.id],
        );
        carouselItems = rows.map((r: { gcs_url: string; media_type: string }) => ({
          url: r.gcs_url,
          mediaType: r.media_type as 'IMAGE' | 'VIDEO',
        }));
      }

      const caption = [post.caption, ...(post.hashtags || []).map((h: string) => `#${h}`)].filter(Boolean).join('\n\n');

      const result = await publishPost(post.brand_ig_id, post.ig_access_token, {
        gcsUrl: post.gcs_url,
        mediaType: post.media_type,
        caption,
        altText: post.alt_text || undefined,
        carouselItems,
      });

      if (result.success) {
        await pool.query(
          `UPDATE scheduled_posts SET status = 'published', published_at = now(), ig_media_id = $2, ig_permalink = $3 WHERE id = $1`,
          [post.id, result.igMediaId, result.permalink],
        );
        results.push({ id: post.id, status: 'published' });
      } else {
        await pool.query(
          `UPDATE scheduled_posts SET status = 'failed', error_message = $2 WHERE id = $1`,
          [post.id, result.error],
        );
        results.push({ id: post.id, status: 'failed', error: result.error });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } finally {
    await pool.end();
  }
};
```

- [ ] **Step 2: Add cron config to vercel.json**

Read current `vercel.json`, then add the cron entry. Add to the top-level config:

```json
{
  "crons": [
    {
      "path": "/api/cron/publish-scheduled",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/cron/publish-scheduled/ vercel.json
git commit -m "feat: Vercel cron job to publish scheduled Instagram posts every 5 minutes"
```

---

### Task 8: AI Content Plan Generator

**Files:**
- Create: `src/lib/server/marketplace/contentPlanGenerator.ts`
- Create: `src/routes/api/brand/generate-plan/+server.ts`
- Create: `src/routes/api/brand/insights/+server.ts`
- Create: `src/routes/api/brand/schedule/+server.ts`
- Create: `src/routes/api/brand/scheduled-posts/+server.ts`

- [ ] **Step 1: Create contentPlanGenerator.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || '' });

export interface ContentPlanItem {
  gcsUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES';
  caption: string;
  hashtags: string[];
  scheduledAt: string; // ISO timestamp
  reasoning: string;
}

export async function generateContentPlan(
  creatives: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO'; fileName: string }>,
  brandProfile: { username: string; name: string; followersCount: number },
  recentPosts: Array<{ caption: string; timestamp: string; likeCount: number; commentsCount: number; mediaType: string }>,
  insightsData: { onlineFollowers?: Record<string, number[]>; topPostingHours?: number[] } | null,
): Promise<ContentPlanItem[]> {
  const creativeSummary = creatives.map((c, i) => `Creative ${i + 1}: ${c.fileName} (${c.mediaType})`).join('\n');

  const postHistory = recentPosts.slice(0, 10).map(p =>
    `- [${p.mediaType}] ${p.timestamp} | ${p.likeCount} likes, ${p.commentsCount} comments | "${(p.caption || '').slice(0, 100)}"`
  ).join('\n');

  const insightsSummary = insightsData?.onlineFollowers
    ? `Follower online activity (hourly averages available). Top posting hours from history: ${insightsData.topPostingHours?.join(', ') || 'unknown'}`
    : 'No insights data available — use general best practices for Indian audience.';

  const prompt = `You are a social media strategist for @${brandProfile.username} (${brandProfile.name}, ${brandProfile.followersCount} followers).

CREATIVES TO SCHEDULE:
${creativeSummary}

RECENT POST HISTORY (last 10 posts):
${postHistory}

AUDIENCE INSIGHTS:
${insightsSummary}

TASK: Create an optimal posting schedule for these ${creatives.length} creatives. For each:
1. Write a caption matching the brand's voice (analyze their recent captions for tone, emoji usage, CTA style)
2. Suggest 5-8 relevant hashtags (mix of broad + niche)
3. Pick the best date/time to post (space them out, avoid posting more than 2/day)
4. Explain your reasoning briefly

Respond in JSON array format:
[
  {
    "creativeIndex": 0,
    "caption": "...",
    "hashtags": ["tag1", "tag2"],
    "scheduledAt": "2026-04-18T19:30:00+05:30",
    "mediaType": "IMAGE",
    "reasoning": "..."
  }
]

Use IST timezone. Start scheduling from tomorrow. Only output the JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const items = JSON.parse(jsonMatch[0]) as Array<{
    creativeIndex: number;
    caption: string;
    hashtags: string[];
    scheduledAt: string;
    mediaType: string;
    reasoning: string;
  }>;

  return items.map(item => ({
    gcsUrl: creatives[item.creativeIndex]?.url || '',
    mediaType: (item.mediaType || creatives[item.creativeIndex]?.mediaType || 'IMAGE') as ContentPlanItem['mediaType'],
    caption: item.caption,
    hashtags: item.hashtags,
    scheduledAt: item.scheduledAt,
    reasoning: item.reasoning,
  }));
}
```

- [ ] **Step 2: Create insights endpoint**

Create `src/routes/api/brand/insights/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import pg from 'pg';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    // Get brand token
    const { rows: [brand] } = await pool.query(
      `SELECT ig_access_token FROM brand_accounts WHERE ig_user_id = $1`,
      [igUserId],
    );
    if (!brand) throw error(404, 'Brand not found');
    const token = brand.ig_access_token;

    // Fetch online_followers insight from Instagram
    const insightsRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
    );
    const insightsJson = insightsRes.ok ? await insightsRes.json() : { data: [] };
    const onlineFollowers = insightsJson.data?.[0]?.values?.[0]?.value || {};

    // Fetch last 10 posts for performance analysis
    const mediaRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=10&access_token=${token}`,
    );
    const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
    const recentPosts = mediaJson.data || [];

    // Compute top posting hours from history
    const hourCounts: Record<number, { total: number; engagement: number }> = {};
    for (const post of recentPosts) {
      const hour = new Date(post.timestamp).getHours();
      if (!hourCounts[hour]) hourCounts[hour] = { total: 0, engagement: 0 };
      hourCounts[hour].total += 1;
      hourCounts[hour].engagement += (post.like_count || 0) + (post.comments_count || 0);
    }
    const topPostingHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => (b.engagement / b.total) - (a.engagement / a.total))
      .slice(0, 5)
      .map(([h]) => parseInt(h));

    const insightsData = { onlineFollowers, topPostingHours, recentPosts };

    // Cache in Supabase
    await pool.query(
      `INSERT INTO brand_insights_cache (brand_ig_id, insights_data) VALUES ($1, $2)`,
      [igUserId, JSON.stringify(insightsData)],
    );

    return json({ ok: true, insights: insightsData });
  } finally {
    await pool.end();
  }
};
```

- [ ] **Step 3: Create generate-plan endpoint**

Create `src/routes/api/brand/generate-plan/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { generateContentPlan } from '$lib/server/marketplace/contentPlanGenerator';
import pg from 'pg';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { creatives } = body as {
    creatives: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO'; fileName: string }>;
  };
  if (!creatives?.length) throw error(400, 'No creatives provided');

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    // Get brand profile
    const { rows: [brand] } = await pool.query(
      `SELECT ig_username, ig_name, ig_followers_count, ig_access_token FROM brand_accounts WHERE ig_user_id = $1`,
      [igUserId],
    );
    if (!brand) throw error(404, 'Brand not found');

    // Get latest cached insights (or fetch fresh)
    const { rows: [cached] } = await pool.query(
      `SELECT insights_data FROM brand_insights_cache WHERE brand_ig_id = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [igUserId],
    );

    let insightsData = cached?.insights_data || null;
    let recentPosts = insightsData?.recentPosts || [];

    // If no cache, fetch fresh
    if (!insightsData) {
      const mediaRes = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/media?fields=caption,media_type,timestamp,like_count,comments_count&limit=10&access_token=${brand.ig_access_token}`,
      );
      const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
      recentPosts = mediaJson.data || [];
    }

    const plan = await generateContentPlan(
      creatives,
      { username: brand.ig_username, name: brand.ig_name, followersCount: brand.ig_followers_count },
      recentPosts,
      insightsData,
    );

    return json({ ok: true, plan });
  } finally {
    await pool.end();
  }
};
```

- [ ] **Step 4: Create schedule endpoint (save/approve posts)**

Create `src/routes/api/brand/schedule/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import pg from 'pg';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { posts } = body as {
    posts: Array<{
      gcsUrl: string;
      mediaType: string;
      caption: string;
      hashtags: string[];
      altText?: string;
      scheduledAt: string;
      aiReasoning?: string;
      carouselItems?: Array<{ gcsUrl: string; mediaType: string; position: number }>;
    }>;
  };

  if (!posts?.length) throw error(400, 'No posts to schedule');

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    const insertedIds = [];

    for (const post of posts) {
      const { rows: [inserted] } = await pool.query(
        `INSERT INTO scheduled_posts (brand_ig_id, gcs_url, media_type, caption, hashtags, alt_text, scheduled_at, status, ai_reasoning)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)
         RETURNING id`,
        [igUserId, post.gcsUrl, post.mediaType, post.caption, post.hashtags, post.altText || '', post.scheduledAt, post.aiReasoning || ''],
      );

      if (post.carouselItems?.length) {
        for (const item of post.carouselItems) {
          await pool.query(
            `INSERT INTO scheduled_post_carousel_items (post_id, gcs_url, media_type, position) VALUES ($1, $2, $3, $4)`,
            [inserted.id, item.gcsUrl, item.mediaType, item.position],
          );
        }
      }

      insertedIds.push(inserted.id);
    }

    return json({ ok: true, scheduledCount: insertedIds.length, ids: insertedIds });
  } finally {
    await pool.end();
  }
};
```

- [ ] **Step 5: Create scheduled-posts listing endpoint**

Create `src/routes/api/brand/scheduled-posts/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import pg from 'pg';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const status = url.searchParams.get('status'); // optional filter

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    let query = `SELECT * FROM scheduled_posts WHERE brand_ig_id = $1`;
    const params: (string | null)[] = [igUserId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);
    return json({ ok: true, posts: rows });
  } finally {
    await pool.end();
  }
};
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/marketplace/contentPlanGenerator.ts src/routes/api/brand/generate-plan/ src/routes/api/brand/insights/ src/routes/api/brand/schedule/ src/routes/api/brand/scheduled-posts/
git commit -m "feat: AI content plan generator, insights fetcher, scheduling and listing endpoints"
```

---

### Task 9: Content Studio UI Components

**Files:**
- Create: `src/lib/components/brands/UploadZone.svelte`
- Create: `src/lib/components/brands/PostCard.svelte`
- Create: `src/lib/components/brands/ContentPlanView.svelte`
- Create: `src/lib/components/brands/ContentStudio.svelte`

- [ ] **Step 1: Create UploadZone.svelte**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CloudArrowUp from 'phosphor-svelte/lib/CloudArrowUp';

  const dispatch = createEventDispatcher();
  let dragging = false;
  let uploading = false;
  let fileInput: HTMLInputElement;

  export let uploads: Array<{ url: string; mediaType: string; fileName: string }> = [];

  async function handleFiles(files: FileList | File[]) {
    uploading = true;
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/brand/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        const newUploads = data.uploads.map((u: { url: string; mediaType: string; gcsPath: string }, i: number) => ({
          url: u.url,
          mediaType: u.mediaType,
          fileName: (files instanceof FileList ? files[i] : files[i])?.name || 'file',
        }));
        uploads = [...uploads, ...newUploads];
        dispatch('uploaded', { uploads });
      }
      if (data.errors?.length) {
        dispatch('error', { errors: data.errors });
      }
    } catch {
      dispatch('error', { errors: [{ file: 'upload', error: 'Network error' }] });
    } finally {
      uploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    dragging = false;
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  }
</script>

<div
  class="upload-zone"
  class:dragging
  class:has-files={uploads.length > 0}
  on:dragover|preventDefault={() => dragging = true}
  on:dragleave={() => dragging = false}
  on:drop|preventDefault={onDrop}
  role="button"
  tabindex="0"
  on:click={() => fileInput.click()}
  on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
>
  <input
    type="file"
    accept="image/jpeg,video/mp4"
    multiple
    bind:this={fileInput}
    on:change={(e) => e.currentTarget.files && handleFiles(e.currentTarget.files)}
    style="display:none"
  />

  {#if uploading}
    <p class="upload-label">Uploading...</p>
  {:else if uploads.length === 0}
    <CloudArrowUp size={32} weight="light" />
    <p class="upload-label">Drop creatives here or click to browse</p>
    <p class="upload-hint">JPEG images or MP4 videos. Max 10 files.</p>
  {:else}
    <div class="upload-thumbs">
      {#each uploads as u}
        <div class="upload-thumb">
          {#if u.mediaType === 'IMAGE'}
            <img src={u.url} alt={u.fileName} />
          {:else}
            <div class="video-thumb">MP4</div>
          {/if}
        </div>
      {/each}
      <div class="upload-add">+</div>
    </div>
  {/if}
</div>

<style>
  .upload-zone {
    border: 2px dashed var(--border-subtle);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
  }
  .upload-zone:hover, .upload-zone.dragging {
    border-color: var(--accent-primary);
    background: var(--panel-surface-soft);
  }
  .upload-zone.has-files { padding: 16px; }
  .upload-label { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin: 0; }
  .upload-hint { font-size: 12px; color: var(--text-muted); margin: 0; }
  .upload-thumbs { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
  .upload-thumb { width: 72px; height: 72px; border-radius: 10px; overflow: hidden; }
  .upload-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .video-thumb {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--glass-medium); font-size: 11px; font-weight: 700; color: var(--text-muted);
  }
  .upload-add {
    width: 72px; height: 72px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    border: 2px dashed var(--border-subtle); font-size: 24px; color: var(--text-muted);
  }
</style>
```

- [ ] **Step 2: Create PostCard.svelte**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Clock from 'phosphor-svelte/lib/Clock';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';

  export let gcsUrl: string;
  export let mediaType: string;
  export let caption: string;
  export let hashtags: string[];
  export let scheduledAt: string;
  export let reasoning: string;
  export let status: string = 'draft';
  export let igPermalink: string = '';
  export let index: number = 0;

  const dispatch = createEventDispatcher();
  let editingCaption = false;
  let editedCaption = caption;
  let showReasoning = false;

  function saveCaption() {
    editingCaption = false;
    dispatch('update', { field: 'caption', value: editedCaption, index });
  }

  $: displayDate = scheduledAt ? new Date(scheduledAt).toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : 'No time set';

  $: statusColor = status === 'published' ? '#4ade80' : status === 'failed' ? '#fb7185' : status === 'scheduled' ? '#FFB84D' : 'var(--text-muted)';
</script>

<div class="post-card">
  <div class="post-thumb">
    {#if mediaType === 'IMAGE' || mediaType === 'CAROUSEL'}
      <img src={gcsUrl} alt="" />
    {:else}
      <div class="post-video-badge">{mediaType}</div>
    {/if}
    <span class="post-type-badge">{mediaType}</span>
  </div>

  <div class="post-body">
    <div class="post-meta">
      <Clock size={14} />
      <span>{displayDate}</span>
      <span class="post-status" style="color: {statusColor}">{status}</span>
    </div>

    {#if editingCaption}
      <textarea class="post-caption-edit" bind:value={editedCaption} on:blur={saveCaption} rows="3"></textarea>
    {:else}
      <p class="post-caption" on:click={() => { editingCaption = true; editedCaption = caption; }}>
        {caption || 'Click to add caption'}
        <PencilSimple size={12} class="edit-icon" />
      </p>
    {/if}

    {#if hashtags.length}
      <div class="post-hashtags">
        {#each hashtags as tag}
          <span class="hashtag">#{tag}</span>
        {/each}
      </div>
    {/if}

    {#if reasoning}
      <button class="reasoning-toggle" on:click={() => showReasoning = !showReasoning}>
        Why this time? <CaretDown size={12} />
      </button>
      {#if showReasoning}
        <p class="reasoning-text">{reasoning}</p>
      {/if}
    {/if}

    {#if igPermalink}
      <a href={igPermalink} target="_blank" rel="noopener" class="permalink">View on Instagram</a>
    {/if}
  </div>

  {#if status === 'draft' || status === 'scheduled'}
    <button class="post-delete" on:click={() => dispatch('delete', { index })} title="Remove">
      <Trash size={16} />
    </button>
  {/if}
</div>

<style>
  .post-card {
    display: flex; gap: 16px; padding: 16px;
    background: var(--panel-surface); border: 1px solid var(--panel-border);
    border-radius: 14px; position: relative;
  }
  .post-thumb {
    width: 80px; height: 80px; border-radius: 10px; overflow: hidden;
    flex-shrink: 0; position: relative;
  }
  .post-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .post-video-badge {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--glass-medium); font-size: 11px; font-weight: 700; color: var(--text-muted);
  }
  .post-type-badge {
    position: absolute; bottom: 4px; left: 4px;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px;
  }
  .post-body { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .post-meta {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--text-muted);
  }
  .post-status { font-weight: 700; text-transform: uppercase; font-size: 10px; }
  .post-caption {
    font-size: 13px; color: var(--text-primary); line-height: 1.5;
    margin: 0; cursor: pointer; display: flex; align-items: start; gap: 6px;
  }
  .post-caption-edit {
    width: 100%; font-size: 13px; font-family: inherit;
    background: var(--bg-elevated); border: 1px solid var(--border-subtle);
    border-radius: 8px; padding: 8px; color: var(--text-primary); resize: vertical;
  }
  :global(.edit-icon) { opacity: 0.3; flex-shrink: 0; margin-top: 3px; }
  .post-hashtags { display: flex; flex-wrap: wrap; gap: 4px; }
  .hashtag {
    font-size: 11px; color: var(--accent-secondary); font-weight: 600;
  }
  .reasoning-toggle {
    background: none; border: none; font-size: 11px; color: var(--text-muted);
    cursor: pointer; padding: 0; display: flex; align-items: center; gap: 4px;
    font-family: inherit;
  }
  .reasoning-text { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0; }
  .permalink { font-size: 12px; color: var(--accent-primary); text-decoration: none; }
  .post-delete {
    position: absolute; top: 12px; right: 12px;
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    padding: 4px; transition: color 0.15s;
  }
  .post-delete:hover { color: var(--accent-primary); }
</style>
```

- [ ] **Step 3: Create ContentPlanView.svelte**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PostCard from './PostCard.svelte';

  export let posts: Array<{
    gcsUrl: string; mediaType: string; caption: string; hashtags: string[];
    scheduledAt: string; reasoning: string; status: string; igPermalink?: string;
  }> = [];

  const dispatch = createEventDispatcher();

  function updatePost(e: CustomEvent) {
    const { field, value, index } = e.detail;
    posts[index] = { ...posts[index], [field]: value };
    posts = posts;
    dispatch('change', { posts });
  }

  function deletePost(e: CustomEvent) {
    const { index } = e.detail;
    posts = posts.filter((_, i) => i !== index);
    dispatch('change', { posts });
  }
</script>

{#if posts.length === 0}
  <div class="plan-empty">
    <p>No posts in the plan yet. Upload creatives and generate a plan.</p>
  </div>
{:else}
  <div class="plan-list">
    {#each posts as post, i (post.gcsUrl + i)}
      <PostCard
        {...post}
        igPermalink={post.igPermalink || ''}
        index={i}
        on:update={updatePost}
        on:delete={deletePost}
      />
    {/each}
  </div>
{/if}

<style>
  .plan-list { display: flex; flex-direction: column; gap: 12px; }
  .plan-empty {
    text-align: center; padding: 32px;
    border: 1px dashed var(--border-subtle); border-radius: 14px;
  }
  .plan-empty p { font-size: 14px; color: var(--text-muted); margin: 0; }
</style>
```

- [ ] **Step 4: Create ContentStudio.svelte (main container)**

```svelte
<script lang="ts">
  import UploadZone from './UploadZone.svelte';
  import ContentPlanView from './ContentPlanView.svelte';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck';

  export let brandProfile: {
    ig_user_id: string; ig_username: string; ig_name: string;
    ig_profile_picture: string; ig_followers_count: number;
  };

  let uploads: Array<{ url: string; mediaType: string; fileName: string }> = [];
  let planPosts: Array<{
    gcsUrl: string; mediaType: string; caption: string; hashtags: string[];
    scheduledAt: string; reasoning: string; status: string;
  }> = [];
  let generating = false;
  let scheduling = false;
  let genError = '';
  let scheduleMsg = '';
  let publishedPosts: Array<Record<string, unknown>> = [];

  async function generatePlan() {
    if (!uploads.length) return;
    generating = true;
    genError = '';
    try {
      const res = await fetch('/api/brand/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatives: uploads }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        planPosts = data.plan.map((p: Record<string, unknown>) => ({ ...p, status: 'draft' }));
      } else {
        genError = data.error || 'Plan generation failed';
      }
    } catch {
      genError = 'Network error';
    } finally {
      generating = false;
    }
  }

  async function approveSchedule() {
    if (!planPosts.length) return;
    scheduling = true;
    scheduleMsg = '';
    try {
      const res = await fetch('/api/brand/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: planPosts }),
      });
      const data = await res.json();
      if (data.ok) {
        scheduleMsg = `${data.scheduledCount} posts scheduled!`;
        planPosts = planPosts.map(p => ({ ...p, status: 'scheduled' }));
        uploads = [];
        await loadPublished();
      } else {
        scheduleMsg = data.error || 'Scheduling failed';
      }
    } catch {
      scheduleMsg = 'Network error';
    } finally {
      scheduling = false;
    }
  }

  async function loadPublished() {
    try {
      const res = await fetch('/api/brand/scheduled-posts');
      const data = await res.json();
      if (data.ok) publishedPosts = data.posts;
    } catch {}
  }

  import { onMount } from 'svelte';
  onMount(loadPublished);
</script>

<div class="studio">
  <!-- Account bar -->
  <div class="studio-account">
    {#if brandProfile.ig_profile_picture}
      <img src={brandProfile.ig_profile_picture} alt="" class="studio-avatar" />
    {/if}
    <div>
      <span class="studio-username">@{brandProfile.ig_username}</span>
      <span class="studio-followers">{brandProfile.ig_followers_count.toLocaleString()} followers</span>
    </div>
  </div>

  <!-- Upload -->
  <UploadZone bind:uploads on:error={(e) => genError = e.detail.errors.map((e: {error: string}) => e.error).join(', ')} />

  <!-- Generate button -->
  {#if uploads.length > 0 && planPosts.length === 0}
    <button class="studio-btn studio-btn--primary" on:click={generatePlan} disabled={generating}>
      <Sparkle size={18} weight="bold" />
      {generating ? 'Generating plan...' : `Generate plan for ${uploads.length} creative${uploads.length > 1 ? 's' : ''}`}
    </button>
  {/if}

  {#if genError}
    <p class="studio-error">{genError}</p>
  {/if}

  <!-- Content plan -->
  {#if planPosts.length > 0}
    <div class="studio-section-label">Content plan</div>
    <ContentPlanView bind:posts={planPosts} />

    {#if planPosts.some(p => p.status === 'draft')}
      <button class="studio-btn studio-btn--approve" on:click={approveSchedule} disabled={scheduling}>
        <CalendarCheck size={18} weight="bold" />
        {scheduling ? 'Scheduling...' : `Approve & schedule ${planPosts.length} posts`}
      </button>
    {/if}

    {#if scheduleMsg}
      <p class="studio-success">{scheduleMsg}</p>
    {/if}
  {/if}

  <!-- Published / scheduled feed -->
  {#if publishedPosts.length > 0}
    <div class="studio-section-label">Scheduled & published</div>
    <ContentPlanView posts={publishedPosts.map(p => ({
      gcsUrl: String(p.gcs_url || ''),
      mediaType: String(p.media_type || 'IMAGE'),
      caption: String(p.caption || ''),
      hashtags: (p.hashtags || []) as string[],
      scheduledAt: String(p.scheduled_at || ''),
      reasoning: String(p.ai_reasoning || ''),
      status: String(p.status || ''),
      igPermalink: String(p.ig_permalink || ''),
    }))} />
  {/if}
</div>

<style>
  .studio { display: flex; flex-direction: column; gap: 20px; }
  .studio-account {
    display: flex; align-items: center; gap: 12px;
    padding: 16px; background: var(--panel-surface); border: 1px solid var(--panel-border);
    border-radius: 14px;
  }
  .studio-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .studio-username { font-size: 15px; font-weight: 700; color: var(--text-primary); display: block; }
  .studio-followers { font-size: 12px; color: var(--text-muted); }
  .studio-section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-top: 8px;
  }
  .studio-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 14px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
    transition: all 0.2s;
  }
  .studio-btn:disabled { opacity: 0.5; cursor: default; }
  .studio-btn--primary {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    color: white;
  }
  .studio-btn--primary:hover:not(:disabled) { box-shadow: 0 0 24px rgba(255, 77, 77, 0.2); }
  .studio-btn--approve {
    background: var(--accent-secondary); color: white;
  }
  .studio-error { font-size: 13px; color: var(--accent-primary); margin: 0; }
  .studio-success { font-size: 13px; color: #4ade80; margin: 0; font-weight: 600; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/brands/UploadZone.svelte src/lib/components/brands/PostCard.svelte src/lib/components/brands/ContentPlanView.svelte src/lib/components/brands/ContentStudio.svelte
git commit -m "feat: Content Studio UI — upload zone, post cards, plan view, and main container"
```

---

### Task 10: Integrate Content Studio into Brand Portal

**Files:**
- Modify: `src/routes/brands/portal/+page.server.ts`
- Modify: `src/routes/brands/portal/+page.svelte`

- [ ] **Step 1: Update page.server.ts to load brand profile**

Replace `src/routes/brands/portal/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';
import {
  BRAND_SESSION_COOKIE,
  verifyBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';
import pg from 'pg';

export const load: PageServerLoad = async ({ cookies }) => {
  const raw = cookies.get(BRAND_SESSION_COOKIE);
  const igUserId = verifyBrandSessionCookieValue(raw);
  const isValid = !!igUserId && igUserId !== '__legacy__';

  let brandProfile = null;
  if (isValid && igUserId) {
    try {
      const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });
      try {
        const { rows: [brand] } = await pool.query(
          `SELECT ig_user_id, ig_username, ig_name, ig_profile_picture, ig_followers_count FROM brand_accounts WHERE ig_user_id = $1`,
          [igUserId],
        );
        brandProfile = brand || null;
      } finally {
        await pool.end();
      }
    } catch {}
  }

  return {
    brandSessionValid: isValid,
    brandProfile,
  };
};
```

- [ ] **Step 2: Add Content Studio tab to portal page**

At the top of the `<script>` block in `src/routes/brands/portal/+page.svelte`, add after existing imports:

```typescript
import ContentStudio from '$lib/components/brands/ContentStudio.svelte';
```

Add a tab state variable alongside existing state:

```typescript
let portalTab: 'creators' | 'content' = 'content';
```

Read `brandProfile` from page data:

```typescript
$: brandProfile = data.brandProfile;
```

Then wrap the existing portal content in a tab toggle. Find the main content container and add before it:

```svelte
<!-- Tab toggle -->
<div class="portal-tabs">
  <button
    class="portal-tab"
    class:active={portalTab === 'content'}
    on:click={() => portalTab = 'content'}
  >Content Studio</button>
  <button
    class="portal-tab"
    class:active={portalTab === 'creators'}
    on:click={() => portalTab = 'creators'}
  >Find Creators</button>
</div>

{#if portalTab === 'content' && brandProfile}
  <ContentStudio {brandProfile} />
{:else if portalTab === 'creators'}
  <!-- existing portal content -->
{/if}
```

Add tab styles:

```css
.portal-tabs {
  display: flex; gap: 4px; margin-bottom: 24px;
  background: var(--panel-surface); border-radius: 12px; padding: 4px;
}
.portal-tab {
  flex: 1; padding: 10px 16px; border: none; border-radius: 10px;
  font-size: 14px; font-weight: 600; font-family: inherit;
  background: transparent; color: var(--text-muted); cursor: pointer;
  transition: all 0.2s;
}
.portal-tab.active {
  background: var(--glass-medium); color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/brands/portal/+page.server.ts src/routes/brands/portal/+page.svelte
git commit -m "feat: integrate Content Studio tab into brand portal with profile loading"
```

---

### Task 11: Environment Variables & Final Wiring

**Files:**
- Modify: `vercel.json` (cron)
- Env vars to set in Vercel dashboard

- [ ] **Step 1: Update vercel.json with cron**

Read current `vercel.json` and add the crons key:

```bash
cat vercel.json
```

Add the `crons` array to the existing config (merge, don't replace).

- [ ] **Step 2: Set environment variables in Vercel**

The following env vars need to be set in Vercel dashboard (Settings → Environment Variables):
- `GCS_SERVICE_ACCOUNT_KEY` — the JSON key for `wagwan-cms@wagwan-bb02b.iam.gserviceaccount.com`
- `CRON_SECRET` — a random string for cron job authentication (Vercel auto-sets this)

- [ ] **Step 3: Add redirect URI to Facebook Developer Console**

Add `{PUBLIC_BASE_URL}/auth/brand-instagram/callback` as a valid redirect URI in your Facebook App's Instagram Login settings.

- [ ] **Step 4: Build and deploy**

```bash
npm run build
git add -A
git commit -m "feat: finalize brand content automation — cron config, env vars"
vercel --prod --yes
vercel alias set <deployment-url> wagwanworld.vercel.app
```

- [ ] **Step 5: Test end-to-end**

1. Go to `wagwanworld.vercel.app/brands/login`
2. Click "Continue with Instagram"
3. Authorize — should redirect to `/brands/portal`
4. Content Studio tab should be the default
5. Upload a JPEG image
6. Click "Generate plan" — AI should produce caption + schedule
7. Edit caption if desired
8. Click "Approve & schedule"
9. Wait for cron (or manually hit `/api/cron/publish-scheduled`)
10. Check Instagram — post should appear
