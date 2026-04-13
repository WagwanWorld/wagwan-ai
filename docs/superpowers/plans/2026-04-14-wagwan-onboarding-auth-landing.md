# Wagwan Onboarding Auth + Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add phone+OTP verification as the first onboarding step (syncing with Wagwan's gRPC auth service), and replace the splash redirect at `/` with a one-page landing page.

**Architecture:** A server-side gRPC client (`wagwanGrpc.ts`) talks to the Wagwan Go backend's `AuthService`. Two SvelteKit API routes proxy browser requests to gRPC. The onboarding page gets a new Step 0 (phone → OTP → JWT). The root page becomes a landing page with a CTA to `/onboarding`. On setup completion, the wagwan user ID is linked to the Supabase profile.

**Tech Stack:** SvelteKit, TypeScript, @grpc/grpc-js, @grpc/proto-loader, Svelte 5, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/server/proto/auth.proto` | Wagwan auth service proto definition |
| Create | `src/lib/server/proto/date.proto` | Wagwan date util proto |
| Create | `src/lib/server/wagwanGrpc.ts` | gRPC client for AuthService (generateOTP, verifyLoginOTP) |
| Create | `src/routes/api/wagwan/auth/send-otp/+server.ts` | POST proxy for GenerateOTP |
| Create | `src/routes/api/wagwan/auth/verify-otp/+server.ts` | POST proxy for VerifyLoginOTP |
| Modify | `src/routes/+page.svelte` | Replace splash with landing page |
| Modify | `src/routes/onboarding/+page.svelte` | Add Step 0 (phone+OTP), link wagwan user at finish |
| Modify | `.env.example` | Add WAGWAN_GRPC_URL |
| Modify | `package.json` | Add @grpc/grpc-js, @grpc/proto-loader |

---

### Task 1: Install gRPC Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/madhviknemani/wagwan-ai && npm install @grpc/grpc-js @grpc/proto-loader
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @grpc/grpc-js and @grpc/proto-loader"
```

---

### Task 2: Copy Proto Files

**Files:**
- Create: `src/lib/server/proto/auth.proto`
- Create: `src/lib/server/proto/date.proto`

- [ ] **Step 1: Create proto directory and copy auth.proto**

Create `src/lib/server/proto/auth.proto`:

```protobuf
syntax="proto3";

package wagwan.auth.api.v1;

import "wagwan/utils/date.proto";

service AuthService {
  rpc GenerateOTP(GenerateOTPRequest) returns (GenerateOTPResponse);
  rpc VerifyLoginOTP(VerifyLoginOTPRequest) returns (VerifyLoginOTPResponse);
  rpc VerifySignUpOTP(VerifySignUpOTPRequest) returns (VerifySignUpOTPResponse);
  rpc Logout(LogoutRequest) returns (LogoutResponse);
}

message GenerateOTPRequest {
  string phone = 1;
}

message GenerateOTPResponse {
}

message VerifyLoginOTPRequest {
  string phone = 1;
  string otp = 2;
}

message VerifyLoginOTPResponse {
  string access_token = 1;
  string refresh_token = 2;
}

message VerifySignUpOTPRequest {
  string name = 1;
  string bio = 2;
  wagwan.utils.Date dob = 3;
  string user_id = 4;
  bytes profile_pic = 5;
  string phone = 6;
  string otp = 7;
}

message VerifySignUpOTPResponse {
  string access_token = 1;
  string refresh_token = 2;
}

message LogoutRequest {}
message LogoutResponse {}
```

Note: We strip `buf.validate` imports since we don't need buf validation on the client side. The proto-loader won't have that dependency.

- [ ] **Step 2: Create date.proto**

Create `src/lib/server/proto/date.proto` at the path the auth.proto imports expect. The import path is `wagwan/utils/date.proto`, so we need the directory structure to match.

Actually, proto-loader resolves imports relative to `includeDirs`. We'll put date.proto at `src/lib/server/proto/wagwan/utils/date.proto` and set the include dir to `src/lib/server/proto/`.

Create `src/lib/server/proto/wagwan/utils/date.proto`:

```protobuf
syntax = "proto3";

package wagwan.utils;

message Date {
  int32 year = 1;
  int32 month = 2;
  int32 day = 3;
}
```

And update auth.proto's path: place it at `src/lib/server/proto/wagwan/auth/api/v1/auth.proto` so proto-loader can resolve the package paths naturally.

Final file layout:
```
src/lib/server/proto/
  wagwan/
    auth/api/v1/auth.proto
    utils/date.proto
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/proto/
git commit -m "chore: add wagwan auth proto definitions for gRPC client"
```

---

### Task 3: Create gRPC Client Module

**Files:**
- Create: `src/lib/server/wagwanGrpc.ts`

- [ ] **Step 1: Create the gRPC client**

Create `src/lib/server/wagwanGrpc.ts`:

```typescript
/**
 * gRPC client for Wagwan AuthService.
 *
 * Connects to the Wagwan Go backend to handle phone OTP auth.
 * Reads WAGWAN_GRPC_URL from env (default: 127.0.0.1:50051).
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { env } from '$env/dynamic/private';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_DIR = join(__dirname, 'proto');
const AUTH_PROTO = join(PROTO_DIR, 'wagwan', 'auth', 'api', 'v1', 'auth.proto');

const packageDef = protoLoader.loadSync(AUTH_PROTO, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_DIR],
});

const proto = grpc.loadPackageDefinition(packageDef) as any;
const AuthService = proto.wagwan.auth.api.v1.AuthService;

let client: InstanceType<typeof AuthService> | null = null;

function getClient(): InstanceType<typeof AuthService> {
  if (client) return client;
  const url = env.WAGWAN_GRPC_URL?.trim() || '127.0.0.1:50051';
  client = new AuthService(url, grpc.credentials.createInsecure());
  return client;
}

/**
 * Send an OTP to the given phone number.
 * Phone must be 13 chars, e.g. "+919327786555".
 */
export function generateOTP(phone: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getClient().generateOTP({ phone }, (err: grpc.ServiceError | null) => {
      if (err) {
        console.error('[WagwanGrpc] GenerateOTP error:', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Verify a login OTP and receive access + refresh tokens.
 * Works for both new and existing users.
 */
export function verifyLoginOTP(
  phone: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return new Promise((resolve, reject) => {
    getClient().verifyLoginOTP({ phone, otp }, (err: grpc.ServiceError | null, res: any) => {
      if (err) {
        console.error('[WagwanGrpc] VerifyLoginOTP error:', err.message);
        reject(err);
      } else {
        resolve({
          accessToken: res.accessToken ?? '',
          refreshToken: res.refreshToken ?? '',
        });
      }
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/wagwanGrpc.ts
git commit -m "feat(auth): add gRPC client for Wagwan AuthService"
```

---

### Task 4: Create Send OTP API Route

**Files:**
- Create: `src/routes/api/wagwan/auth/send-otp/+server.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/wagwan/auth/send-otp/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateOTP } from '$lib/server/wagwanGrpc';

/**
 * POST /api/wagwan/auth/send-otp
 * Body: { "phone": "+91XXXXXXXXXX" }
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: { phone?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
    return json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  try {
    await generateOTP(phone);
    return json({ ok: true });
  } catch (err: any) {
    const msg = err?.details || err?.message || 'otp_send_failed';
    return json({ ok: false, error: msg }, { status: 502 });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/wagwan/auth/send-otp/+server.ts
git commit -m "feat(api): add POST /api/wagwan/auth/send-otp"
```

---

### Task 5: Create Verify OTP API Route

**Files:**
- Create: `src/routes/api/wagwan/auth/verify-otp/+server.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/wagwan/auth/verify-otp/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyLoginOTP } from '$lib/server/wagwanGrpc';

/**
 * POST /api/wagwan/auth/verify-otp
 * Body: { "phone": "+91XXXXXXXXXX", "otp": "123456" }
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: { phone?: unknown; otp?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

  if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
    return json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }
  if (!otp || otp.length !== 6) {
    return json({ ok: false, error: 'invalid_otp' }, { status: 400 });
  }

  try {
    const tokens = await verifyLoginOTP(phone, otp);
    return json({ ok: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err: any) {
    const msg = err?.details || err?.message || 'otp_verify_failed';
    return json({ ok: false, error: msg }, { status: 502 });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/wagwan/auth/verify-otp/+server.ts
git commit -m "feat(api): add POST /api/wagwan/auth/verify-otp"
```

---

### Task 6: Add WAGWAN_GRPC_URL to .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the env var**

In `.env.example`, after the `WAGWAN_JWT_SECRET` section (around line 81), add:

```
# gRPC endpoint for Wagwan auth service (OTP login). Default 127.0.0.1:50051.
# Used by POST /api/wagwan/auth/send-otp and /api/wagwan/auth/verify-otp.
WAGWAN_GRPC_URL=127.0.0.1:50051
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add WAGWAN_GRPC_URL to .env.example"
```

---

### Task 7: Add Wagwan Auth Step to Onboarding (Step 0)

**Files:**
- Modify: `src/routes/onboarding/+page.svelte`

This is the largest task. We add Step 0 (phone + OTP) before the existing Google OAuth step.

- [ ] **Step 1: Add wagwan auth state variables**

In the `<script>` block of `src/routes/onboarding/+page.svelte`, after the existing variable declarations (around line 48, after `let finishError = '';`), add:

```typescript
  // ── Wagwan Auth (Step 0) ──
  let wagwanPhone = '';
  let wagwanOtp = '';
  let wagwanOtpSent = false;
  let wagwanVerified = false;
  let wagwanAccessToken = '';
  let wagwanRefreshToken = '';
  let wagwanUserId = '';
  let wagwanError = '';
  let wagwanLoading = false;
```

- [ ] **Step 2: Change initial step to 0**

Change `let step = 1;` (line 12) to:

```typescript
  let step = 0;
```

- [ ] **Step 3: Add wagwan auth functions**

After the `connectAppleMusic` function (around line 318), add:

```typescript
  async function sendOtp() {
    wagwanError = '';
    const phone = wagwanPhone.trim();
    if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
      wagwanError = 'Enter a valid phone number (e.g. +919876543210)';
      return;
    }
    wagwanLoading = true;
    try {
      const res = await fetch('/api/wagwan/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.ok) {
        wagwanError = data.error || 'Could not send OTP. Try again.';
      } else {
        wagwanOtpSent = true;
      }
    } catch {
      wagwanError = 'Network error — check your connection.';
    } finally {
      wagwanLoading = false;
    }
  }

  async function verifyOtp() {
    wagwanError = '';
    const phone = wagwanPhone.trim();
    const otp = wagwanOtp.trim();
    if (!otp || otp.length !== 6) {
      wagwanError = 'Enter the 6-digit code.';
      return;
    }
    wagwanLoading = true;
    try {
      const res = await fetch('/api/wagwan/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!data.ok) {
        wagwanError = data.error || 'Invalid code. Try again.';
      } else {
        wagwanAccessToken = data.accessToken;
        wagwanRefreshToken = data.refreshToken;
        // Decode JWT to get wagwan user ID
        try {
          const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
          wagwanUserId = payload.id || '';
        } catch {
          wagwanUserId = '';
        }
        // Persist
        try {
          localStorage.setItem('wagwan_access_token', data.accessToken);
          localStorage.setItem('wagwan_refresh_token', data.refreshToken);
          if (wagwanUserId) localStorage.setItem('wagwan_user_id', wagwanUserId);
        } catch {}
        wagwanVerified = true;
        step = 1;
      }
    } catch {
      wagwanError = 'Network error — check your connection.';
    } finally {
      wagwanLoading = false;
    }
  }
```

- [ ] **Step 4: Restore wagwan state on mount**

In the `onMount` block, at the start of the `try` block (around line 106, after `const savedGoogle = localStorage.getItem('onboarding_google');` but before that line), add wagwan state restoration:

```typescript
      // Restore wagwan auth state
      const savedWagwanToken = localStorage.getItem('wagwan_access_token');
      const savedWagwanUserId = localStorage.getItem('wagwan_user_id');
      if (savedWagwanToken && savedWagwanUserId) {
        wagwanVerified = true;
        wagwanAccessToken = savedWagwanToken;
        wagwanUserId = savedWagwanUserId;
        wagwanRefreshToken = localStorage.getItem('wagwan_refresh_token') || '';
      }
```

- [ ] **Step 5: Update auto-advance logic**

In the auto-advance block (around line 289-300), update to account for step 0. Replace:

```typescript
    if (
      !params.get('google_connected') &&
      !params.get('ig_connected') &&
      !params.get('spotify') &&
      !params.get('linkedin') &&
      !params.get('apple')
    ) {
      if (igConnected && googleConnected) step = 3;
      else if (igConnected && !googleConnected) step = 3;
      else if (googleConnected) step = 2;
    }
```

With:

```typescript
    if (
      !params.get('google_connected') &&
      !params.get('ig_connected') &&
      !params.get('spotify') &&
      !params.get('linkedin') &&
      !params.get('apple')
    ) {
      if (igConnected && googleConnected) step = 3;
      else if (igConnected && !googleConnected) step = 3;
      else if (googleConnected) step = 2;
      else if (wagwanVerified) step = 1;
    }
```

- [ ] **Step 6: Update progress dots**

In the template, update the progress dots to show 6 steps (0-5). Change:

```svelte
    <div class="ob-progress">
      {#each [1,2,3,4,5] as s}
        <div class="ob-dot" class:active={step >= s} class:current={step === s}></div>
      {/each}
    </div>
```

To:

```svelte
    <div class="ob-progress">
      {#each [0,1,2,3,4,5] as s}
        <div class="ob-dot" class:active={step >= s} class:current={step === s}></div>
      {/each}
    </div>
```

- [ ] **Step 7: Add Step 0 template**

In the template, before the `{#if step === 1}` block (the Google step, around line 466), add:

```svelte
    <!-- ═══ STEP 0: Wagwan Auth (Phone + OTP) ═══ -->
    {#if step === 0}
    <div class="ob-step screen-enter">
      <div class="ob-mark">wagwan</div>

      {#if !wagwanOtpSent}
        <h1 class="ob-h1">What's your<br>number?</h1>
        <p class="ob-sub">We'll send you a code to verify your identity.</p>

        {#if wagwanError}
          <p class="ob-error" role="alert">{wagwanError}</p>
        {/if}

        <div class="ob-phone-field">
          <input
            type="tel"
            bind:value={wagwanPhone}
            placeholder="+91 98765 43210"
            class="ob-input"
            maxlength="13"
            on:keydown={(e) => { if (e.key === 'Enter') sendOtp(); }}
          />
        </div>

        <div class="ob-bottom">
          <button
            type="button"
            class="ob-cta"
            on:click={sendOtp}
            disabled={wagwanLoading || wagwanPhone.trim().length < 13}
          >
            {wagwanLoading ? 'Sending...' : 'Send Code'}
          </button>
        </div>
      {:else}
        <h1 class="ob-h1">Enter the<br>code.</h1>
        <p class="ob-sub">Sent to {wagwanPhone} &middot; <button type="button" class="ob-change-link" on:click={() => { wagwanOtpSent = false; wagwanOtp = ''; wagwanError = ''; }}>Change</button></p>

        {#if wagwanError}
          <p class="ob-error" role="alert">{wagwanError}</p>
        {/if}

        <div class="ob-otp-field">
          <input
            type="text"
            inputmode="numeric"
            bind:value={wagwanOtp}
            placeholder="000000"
            class="ob-input ob-input--otp"
            maxlength="6"
            autocomplete="one-time-code"
            on:input={() => { if (wagwanOtp.length === 6) verifyOtp(); }}
            on:keydown={(e) => { if (e.key === 'Enter') verifyOtp(); }}
          />
        </div>

        <div class="ob-bottom">
          <button
            type="button"
            class="ob-cta"
            on:click={verifyOtp}
            disabled={wagwanLoading || wagwanOtp.trim().length !== 6}
          >
            {wagwanLoading ? 'Verifying...' : 'Verify'}
          </button>
          <button type="button" class="ob-skip-link" on:click={sendOtp} disabled={wagwanLoading}>
            Resend code
          </button>
        </div>
      {/if}
    </div>

    <!-- ═══ STEP 1: Google or Instagram ═══ -->
    {:else if step === 1}
```

And remove the original `{#if step === 1}` line (since Step 0's else-if now chains into it).

- [ ] **Step 8: Add Step 0 styles**

In the `<style>` block, add after the `.ob-city-input::placeholder` rule (around line 1101):

```css
  /* Phone + OTP inputs (Step 0) */
  .ob-phone-field,
  .ob-otp-field {
    margin-top: 32px;
  }

  .ob-input {
    width: 100%;
    padding: 16px 20px;
    background: var(--glass-light);
    border: 1.5px solid var(--border-subtle);
    border-radius: 16px;
    color: var(--text-primary);
    font-size: 18px;
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    outline: none;
    transition: border-color 0.15s;
  }
  .ob-input:focus {
    border-color: var(--accent-primary);
  }
  .ob-input::placeholder {
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  .ob-input--otp {
    font-size: 28px;
    text-align: center;
    letter-spacing: 0.3em;
    padding: 18px 20px;
  }

  .ob-change-link {
    background: none;
    border: none;
    color: var(--accent-primary);
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition: text-decoration-color 0.15s;
  }
  .ob-change-link:hover {
    text-decoration-color: var(--accent-primary);
  }
```

- [ ] **Step 9: Link wagwan user in finish function**

In the `finish()` function, after the `fetch('/api/profile/save', ...)` call (around line 427), add:

```typescript
    // Link wagwan user if authenticated
    const wToken = wagwanAccessToken || localStorage.getItem('wagwan_access_token') || '';
    const wSub = accountSub;
    if (wToken && wSub) {
      fetch('/api/wagwan/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wToken}`,
        },
        body: JSON.stringify({ googleSub: wSub }),
      }).catch(() => {});
    }
```

- [ ] **Step 10: Commit**

```bash
git add src/routes/onboarding/+page.svelte
git commit -m "feat(onboarding): add phone+OTP as Step 0 with Wagwan auth"
```

---

### Task 8: Replace Landing Page

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Replace the splash page**

Replace the entire content of `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import {
    isAppSessionValid,
    maybeRepairIgOnlyAccountKey,
  } from '$lib/auth/sessionGate';

  let visible = false;
  let g1: HTMLDivElement, g2: HTMLDivElement, g3: HTMLDivElement;
  let raf: number;
  let shouldShowLanding = false;

  function startGradient() {
    let prev = 0;
    function tick(ts: number) {
      prev = ts;
      const t = ts * 0.001;
      if (g1) {
        const x = Math.sin(t * 0.107) * 22 + Math.sin(t * 0.229) * 10;
        const y = Math.cos(t * 0.091) * 18 + Math.cos(t * 0.173) * 8;
        g1.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g2) {
        const x = Math.sin(t * 0.173 + 1.3) * 28 + Math.cos(t * 0.293) * 12;
        const y = Math.cos(t * 0.131 + 0.8) * 22 + Math.sin(t * 0.211) * 9;
        g2.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g3) {
        const x = Math.sin(t * 0.059 + 0.5) * 14 + Math.cos(t * 0.089) * 7;
        const y = Math.cos(t * 0.047 + 1.2) * 16 + Math.sin(t * 0.079) * 6;
        g3.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem('wagwan_profile_v2');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.setupComplete) {
        const repaired = maybeRepairIgOnlyAccountKey(parsed as UserProfile);
        if (repaired) {
          profile.set(repaired);
          void fetch('/api/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleSub: repaired.googleSub,
              profile: repaired,
              tokens: {},
            }),
          }).catch(() => {});
        }
        if (isAppSessionValid(get(profile))) {
          goto('/home', { replaceState: true });
          return;
        }
      }
    } catch {}
    // Show the landing page
    shouldShowLanding = true;
    setTimeout(() => { visible = true; startGradient(); }, 60);
  });

  onDestroy(() => { if (raf) cancelAnimationFrame(raf); });
</script>

{#if shouldShowLanding}
<div class="landing-root">
  <!-- Gradient background -->
  <div class="landing-grad" class:ready={visible}>
    <div class="landing-g landing-g--a" bind:this={g1}></div>
    <div class="landing-g landing-g--b" bind:this={g2}></div>
    <div class="landing-g landing-g--c" bind:this={g3}></div>
    <div class="landing-vignette" aria-hidden="true"></div>
  </div>

  <div class="landing-content" class:ready={visible}>
    <nav class="landing-nav">
      <span class="landing-logo">wagwan</span>
    </nav>

    <div class="landing-hero">
      <h1 class="landing-h1">Your identity,<br>understood.</h1>
      <p class="landing-sub">
        Wagwan AI learns who you are from the platforms you use —
        your music, your posts, your calendar — and gives you
        personalized recommendations, insights, and a living digital identity.
      </p>
      <button class="landing-cta" on:click={() => goto('/onboarding')}>
        Get Started
      </button>
    </div>

    <div class="landing-features">
      <div class="landing-feature">
        <div class="landing-feature-icon">&#10024;</div>
        <h3 class="landing-feature-title">Know yourself better</h3>
        <p class="landing-feature-desc">AI-powered identity graph built from your real digital footprint.</p>
      </div>
      <div class="landing-feature">
        <div class="landing-feature-icon">&#9881;</div>
        <h3 class="landing-feature-title">Personalized everything</h3>
        <p class="landing-feature-desc">Recommendations for food, music, events, and more — tuned to you.</p>
      </div>
      <div class="landing-feature">
        <div class="landing-feature-icon">&#128274;</div>
        <h3 class="landing-feature-title">Your data, your control</h3>
        <p class="landing-feature-desc">You decide what to connect and what stays private. Always.</p>
      </div>
    </div>
  </div>
</div>
{:else}
<!-- Brief blank while checking session -->
<div style="flex:1; display:flex; align-items:center; justify-content:center;">
  <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-size:22px;" class="pulse-glow">
    ✦
  </div>
</div>
{/if}

<style>
  .landing-root {
    position: fixed; inset: 0;
    background: var(--bg-primary);
    overflow-y: auto;
    scrollbar-width: none;
    font-family: var(--font-sans);
  }

  /* Gradient — same pattern as onboarding */
  .landing-grad {
    position: fixed; inset: 0;
    opacity: 0;
    transition: opacity 2s ease;
    pointer-events: none;
    z-index: 0;
  }
  .landing-grad.ready { opacity: 1; }

  .landing-g {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
    transform: translate(-50%, -50%);
  }
  .landing-g--a {
    width: 110vw; height: 110vw;
    left: 30%; top: 20%;
    background: radial-gradient(ellipse at center, var(--ambient-blue) 0%, transparent 70%);
    filter: blur(calc(72px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.52 * var(--mesh-orb-opacity-scale, 1));
  }
  .landing-g--b {
    width: 85vw; height: 85vw;
    left: 60%; top: 55%;
    background: radial-gradient(ellipse at center, var(--ambient-red) 0%, transparent 70%);
    filter: blur(calc(64px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.32 * var(--mesh-orb-opacity-scale, 1));
  }
  .landing-g--c {
    width: 130vw; height: 130vw;
    left: 40%; top: 35%;
    background: radial-gradient(ellipse at center, var(--ambient-gold) 0%, transparent 72%);
    filter: blur(calc(90px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.38 * var(--mesh-orb-opacity-scale, 1));
  }
  .landing-vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 50%, transparent 40%, color-mix(in srgb, var(--bg-primary) 82%, #000) 100%);
    pointer-events: none;
  }

  /* Content */
  .landing-content {
    position: relative;
    z-index: 1;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top, 0px) 28px env(safe-area-inset-bottom, 28px);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s;
  }
  .landing-content.ready {
    opacity: 1;
    transform: translateY(0);
  }

  .landing-nav {
    padding: max(20px, env(safe-area-inset-top, 20px)) 0 0;
    flex-shrink: 0;
  }
  .landing-logo {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .landing-hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px 0 32px;
  }

  .landing-h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 12vw, 64px);
    font-weight: 800;
    font-style: italic;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0 0 20px;
  }

  .landing-sub {
    font-size: 16px;
    color: var(--text-secondary);
    line-height: 1.65;
    max-width: min(26rem, 100%);
    margin: 0 0 36px;
  }

  .landing-cta {
    width: fit-content;
    padding: 16px 40px;
    border-radius: 100px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    border: none;
    color: white;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 4px 24px var(--accent-glow);
    transition: transform 0.15s, opacity 0.15s;
  }
  .landing-cta:active { transform: scale(0.97); }

  .landing-features {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding-bottom: max(32px, env(safe-area-inset-bottom, 32px));
  }

  .landing-feature {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(var(--blur-light));
  }

  .landing-feature-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }

  .landing-feature-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 6px;
  }

  .landing-feature-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  @media (min-width: 768px) {
    .landing-content {
      max-width: 48rem;
      margin: 0 auto;
      width: 100%;
    }
    .landing-features {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: replace splash redirect with landing page"
```

---

### Task 9: Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Type-check**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json
```

Expected: No errors. If there are type errors, fix them.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Start dev server and test**

```bash
npm run dev
```

Test:
1. Open `http://localhost:5173/` — should see the landing page with "Your identity, understood." headline and "Get Started" button.
2. Click "Get Started" — should navigate to `/onboarding` and show Step 0 (phone input).
3. Enter a phone number like `+919876543210` — "Send Code" button enables.
4. If the Wagwan gRPC server is running at 50051, test the full OTP flow.
5. After verification, should advance to Step 1 (Google OAuth) as before.

- [ ] **Step 4: Add WAGWAN_GRPC_URL to .env**

Add to your local `.env`:

```
WAGWAN_GRPC_URL=127.0.0.1:50051
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve issues from smoke testing wagwan auth onboarding"
```
