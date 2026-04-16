# Micro-Creator Landing & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the identity-focused landing page and 5-step onboarding wizard with a bold, single-screen micro-creator pitch ("Post. Get paid. Your AI handles the rest.") and a frictionless single-page Google + Instagram auth flow, plus build out the /earn page with status, metrics, and campaign cards.

**Architecture:** The landing page (`/src/routes/+page.svelte`) gets a full rewrite — new hero copy, embedded auth buttons replacing the "Get Started" CTA, and 3 value-prop cards below the fold. The onboarding page (`/src/routes/onboarding/+page.svelte`) is replaced with a single-page auth card that appears inline after clicking an auth button on the landing page. The earn page (`/src/routes/(app)/earn/+page.svelte`) already has wallet, campaigns, rates, and identity graph — we reshape the UI to match the spec's simpler status-driven layout while keeping the existing data-fetching logic.

**Tech Stack:** SvelteKit 2.7, Svelte 5, Tailwind CSS 3.4, existing CSS tokens (OKLCH), Phosphor Svelte icons, existing Google/Instagram OAuth flows.

**Design Reference:** 21st.dev — generous whitespace, max 2 font sizes per screen, high-contrast headline on dark, subtle hover animations (scale + glow), glass-panel cards.

---

### Task 1: Landing Page — Hero Rewrite

**Files:**
- Modify: `src/routes/+page.svelte` (full rewrite of lines 69–119 template, lines 121–282 styles)

The existing script block (lines 1–67) stays mostly intact — session check, redirect to `/home`, gradient animation. We rewrite the template and styles.

- [ ] **Step 1: Replace the hero template**

Replace lines 69–119 (everything inside `{#if shouldShowLanding}...{/if}` and the `{:else}` block) with:

```svelte
{#if shouldShowLanding}
<div class="landing-root">
  <div class="landing-grad" class:ready={visible}>
    <div class="landing-g landing-g--a mesh-animate" bind:this={g1}></div>
    <div class="landing-g landing-g--b mesh-animate" bind:this={g2}></div>
    <div class="landing-g landing-g--c mesh-animate" bind:this={g3}></div>
    <div class="landing-vignette" aria-hidden="true"></div>
  </div>

  <div class="landing-content" class:ready={visible}>
    {#if !authStarted}
      <!-- Hero state -->
      <nav class="landing-nav">
        <img src="/logo-white.svg" alt="WagwanAI" class="landing-logo-img" />
      </nav>

      <div class="landing-hero">
        <h1 class="landing-h1">Post. Get paid.<br>Your AI handles the&nbsp;rest.</h1>
        <p class="landing-sub">
          Wagwan matches you with brands, auto-posts your content, and handles analytics. You just keep being you.
        </p>
        <div class="landing-auth-buttons">
          <button class="landing-auth-btn" on:click={startGoogle}>
            <img src="/icons/google.svg" alt="" class="auth-icon" />
            Continue with Google
          </button>
          <button class="landing-auth-btn" on:click={startInstagram}>
            <img src="/icons/instagram.svg" alt="" class="auth-icon" />
            Continue with Instagram
          </button>
        </div>
        <p class="landing-trust">Join micro-creators already earning</p>
      </div>

      <div class="landing-section-label">How it works</div>

      <div class="landing-cards">
        <div class="landing-card">
          <div class="landing-card-icon"><MagnetStraight size={28} weight="duotone" /></div>
          <h3 class="landing-card-title">Auto-matched</h3>
          <p class="landing-card-desc">Brands find you based on your vibe, not your follower count.</p>
        </div>
        <div class="landing-card">
          <div class="landing-card-icon"><Lightning size={28} weight="duotone" /></div>
          <h3 class="landing-card-title">Auto-posted</h3>
          <p class="landing-card-desc">Content suggestions ready to go. Approve and it's live.</p>
        </div>
        <div class="landing-card">
          <div class="landing-card-icon"><ChartLineUp size={28} weight="duotone" /></div>
          <h3 class="landing-card-title">Auto-reported</h3>
          <p class="landing-card-desc">Analytics packaged and sent to brands. You don't touch a thing.</p>
        </div>
      </div>

    {:else}
      <!-- Auth card state -->
      <div class="auth-card-wrapper">
        <div class="auth-card">
          {#if displayPicture}
            <img src={displayPicture} alt="" class="auth-avatar" />
          {/if}
          {#if displayName}
            <p class="auth-name">{displayName}</p>
          {/if}

          <div class="auth-card-buttons">
            <button
              class="landing-auth-btn"
              class:connected={googleConnected}
              disabled={googleConnected || googleConnecting}
              on:click={startGoogle}
            >
              {#if googleConnected}
                <Check size={18} weight="bold" /> Google connected
              {:else if googleConnecting}
                Connecting…
              {:else}
                <img src="/icons/google.svg" alt="" class="auth-icon" /> Continue with Google
              {/if}
            </button>

            <button
              class="landing-auth-btn"
              class:connected={igConnected}
              disabled={igConnected || igConnecting}
              on:click={startInstagram}
            >
              {#if igConnected}
                <Check size={18} weight="bold" /> Instagram connected
              {:else if igConnecting}
                Connecting…
              {:else}
                <img src="/icons/instagram.svg" alt="" class="auth-icon" /> Continue with Instagram
              {/if}
            </button>
          </div>

          {#if authError}
            <p class="auth-error">{authError}</p>
          {/if}

          {#if googleConnected && igConnected}
            <button class="landing-cta" on:click={finishSetup}>
              {#if finishing}Saving…{:else}Start earning{/if}
            </button>
          {:else if googleConnected || igConnected}
            <p class="auth-hint">Connect both for the best brand matches — or <button class="auth-skip-link" on:click={finishSetup}>skip for now</button></p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
{:else}
<div style="flex:1; display:flex; align-items:center; justify-content:center;">
  <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#FF4D4D,#FFB84D);display:flex;align-items:center;justify-content:center;font-size:22px;" class="pulse-glow">
    ✦
  </div>
</div>
{/if}
```

- [ ] **Step 2: Add new script variables and imports**

Add these imports and variables to the existing `<script>` block. Keep all existing imports and the `onMount`/`onDestroy`/`startGradient` logic. Add after line 10 (after the ProductPreviewCard import, which we no longer use but can leave):

```svelte
  import MagnetStraight from 'phosphor-svelte/lib/MagnetStraight';
  import Lightning from 'phosphor-svelte/lib/Lightning';
  import ChartLineUp from 'phosphor-svelte/lib/ChartLineUp';
  import Check from 'phosphor-svelte/lib/Check';
  import { primaryAccountKeyFromOAuthState } from '$lib/auth/accountKey';
  import { fetchCloudProfile } from '$lib/auth/profileRemote';
  import type { InstagramIdentity } from '$lib/server/instagram';
  import type { GoogleIdentity } from '$lib/utils';
  import { page } from '$app/stores';

  let authStarted = false;
  let googleConnected = false;
  let googleConnecting = false;
  let googleIdentity: GoogleIdentity | null = null;
  let googleTokens: { accessToken: string; refreshToken: string } | null = null;
  let igConnected = false;
  let igConnecting = false;
  let igIdentity: InstagramIdentity | null = null;
  let igToken = '';
  let authError = '';
  let finishing = false;

  $: displayName = googleIdentity?.name?.split(' ')[0] || igIdentity?.displayName?.split(' ')[0] || '';
  $: displayPicture = googleIdentity?.picture || igIdentity?.profilePicture || '';

  function readCookie(name: string): string | undefined {
    return document.cookie.split('; ').find(c => c.startsWith(`${name}=`))?.split('=').slice(1).join('=');
  }
  function clearCookie(name: string) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
  function cleanParam(key: string) {
    const u = new URL(window.location.href);
    u.searchParams.delete(key);
    window.history.replaceState({}, '', u.toString());
  }

  function startGoogle() {
    authStarted = true;
    googleConnecting = true;
    window.location.href = '/auth/google?redirect=/';
  }

  function startInstagram() {
    authStarted = true;
    igConnecting = true;
    window.location.href = '/auth/instagram?redirect=/';
  }

  async function finishSetup() {
    finishing = true;
    authError = '';

    const accountSub = primaryAccountKeyFromOAuthState({
      googleConnected,
      googleIdentity,
      igConnected,
      igIdentity,
    });
    if (!accountSub) {
      authError = 'Could not determine your account. Try connecting again.';
      finishing = false;
      return;
    }

    const name = googleIdentity?.name || igIdentity?.displayName || '';
    const city = igIdentity?.city || '';
    const interests = igIdentity?.interests?.length ? igIdentity.interests
      : googleIdentity?.lifestyleSignals?.length ? googleIdentity.lifestyleSignals
      : ['Music', 'Food', 'Fitness', 'Nightlife'];

    const fullProfile = {
      googleSub: accountSub,
      name, city, interests,
      budget: 'mid' as const,
      social: 'both' as const,
      intents: ['Discovering new things', 'Music & culture', 'Food & dining'],
      setupComplete: true,
      instagramConnected: igConnected,
      instagramIdentity: igIdentity,
      spotifyConnected: false,
      spotifyIdentity: null,
      appleMusicConnected: false,
      appleMusicIdentity: null,
      youtubeConnected: false,
      youtubeIdentity: null,
      googleConnected,
      googleIdentity,
      googleAccessToken: googleTokens?.accessToken ?? '',
      googleRefreshToken: googleTokens?.refreshToken ?? '',
      linkedinConnected: false,
      linkedinIdentity: null,
      savedItems: [] as import('$lib/stores/profile').SavedItem[],
      savingsTotal: 0,
      lastVisit: '',
      profileUpdatedAt: new Date().toISOString(),
      locationUpdatedAt: '',
    };

    profile.set(fullProfile);

    const tokens: Record<string, string> = {};
    if (googleTokens?.accessToken) tokens.googleAccessToken = googleTokens.accessToken;
    if (googleTokens?.refreshToken) tokens.googleRefreshToken = googleTokens.refreshToken;
    if (igToken) tokens.instagramToken = igToken;

    fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSub: accountSub, profile: fullProfile, tokens }),
    }).catch(() => {});

    try {
      localStorage.removeItem('onboarding_google');
      localStorage.removeItem('onboarding_ig');
      localStorage.removeItem('onboarding_ig_token');
    } catch {}

    void goto('/home', { replaceState: true });
  }
```

- [ ] **Step 3: Add OAuth callback handling to `onMount`**

Inside the existing `onMount`, after the `shouldShowLanding = true` line (before the `setTimeout`), add callback handling:

```typescript
    // Handle Google callback
    const params = new URL(window.location.href).searchParams;
    if (params.get('google_connected') === '1') {
      authStarted = true;
      const idRaw = readCookie('google_identity');
      const tokRaw = readCookie('google_tokens');
      if (idRaw) { try { googleIdentity = JSON.parse(decodeURIComponent(idRaw)); } catch {} clearCookie('google_identity'); }
      if (tokRaw) { try { googleTokens = JSON.parse(decodeURIComponent(tokRaw)); } catch {} clearCookie('google_tokens'); }
      googleConnected = true;
      googleConnecting = false;
      try { localStorage.setItem('onboarding_google', JSON.stringify({ identity: googleIdentity, tokens: googleTokens })); } catch {}
      cleanParam('google_connected');
    }

    // Handle Instagram callback
    if (params.get('ig_connected') === '1') {
      authStarted = true;
      const redemptionToken = (params.get('ig_rt') || '').trim() || readCookie('ig_redemption');
      clearCookie('ig_redemption');
      cleanParam('ig_connected');
      cleanParam('ig_rt');

      if (redemptionToken) {
        igConnected = true;
        igConnecting = false;
        fetch(`/api/instagram/identity?token=${encodeURIComponent(redemptionToken)}`)
          .then(async r => {
            if (r.ok) {
              const data = await r.json();
              igIdentity = data.identity;
              igToken = data.token || redemptionToken;
              try {
                localStorage.setItem('onboarding_ig', JSON.stringify(igIdentity));
                localStorage.setItem('onboarding_ig_token', igToken);
              } catch {}
            } else {
              authError = 'Could not load Instagram profile — try again.';
            }
          })
          .catch(() => { authError = 'Instagram connection failed.'; });
      } else {
        authError = 'Instagram could not finish. Try Connect again.';
      }
    }

    // Restore saved auth state from localStorage
    try {
      const savedGoogle = localStorage.getItem('onboarding_google');
      if (savedGoogle) {
        const parsed = JSON.parse(savedGoogle);
        googleIdentity = parsed.identity;
        googleTokens = parsed.tokens;
        googleConnected = true;
        authStarted = true;
      }
      const savedIg = localStorage.getItem('onboarding_ig');
      if (savedIg) {
        igIdentity = JSON.parse(savedIg);
        igConnected = true;
        authStarted = true;
      }
      const savedIgToken = localStorage.getItem('onboarding_ig_token');
      if (savedIgToken) igToken = savedIgToken;
    } catch {}
```

- [ ] **Step 4: Verify icon assets exist**

Check that `/static/icons/google.svg` and `/static/icons/instagram.svg` exist. If not, create simple SVG icons.

Run: `ls static/icons/google.svg static/icons/instagram.svg`

- [ ] **Step 5: Run dev server and verify the landing page loads**

Run: `npm run dev`

Open `http://localhost:5173`. Verify:
- Hero headline "Post. Get paid. Your AI handles the rest." is visible
- Two auth buttons are visible (Google + Instagram)
- Three value-prop cards appear below the fold
- Mesh gradient animates in the background
- Clicking an auth button redirects to the OAuth flow

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: rewrite landing page with micro-creator earning pitch and inline auth"
```

---

### Task 2: Landing Page — Styles

**Files:**
- Modify: `src/routes/+page.svelte` (replace `<style>` block, lines 121–282)

- [ ] **Step 1: Replace the full `<style>` block**

Replace everything from `<style>` to `</style>` with:

```css
<style>
  .landing-root {
    position: fixed; inset: 0;
    background: var(--bg-primary);
    overflow-y: auto;
    scrollbar-width: none;
    font-family: var(--font-sans);
  }

  /* ── Gradient backdrop (unchanged) ── */
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

  /* ── Content wrapper ── */
  .landing-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: env(safe-area-inset-top, 0px) 28px env(safe-area-inset-bottom, 28px);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s;
  }
  .landing-content.ready {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Nav ── */
  .landing-nav {
    padding: max(20px, env(safe-area-inset-top, 20px)) 0 0;
    flex-shrink: 0;
    width: 100%;
  }
  .landing-logo-img {
    height: 18px;
    width: auto;
    opacity: 0.7;
  }

  /* ── Hero ── */
  .landing-hero {
    min-height: 70dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 48px 0 32px;
    max-width: 640px;
  }

  .landing-h1 {
    font-family: var(--font-sans);
    font-size: clamp(36px, 10vw, 60px);
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0 0 20px;
  }

  .landing-sub {
    font-size: 17px;
    color: var(--text-secondary);
    line-height: 1.65;
    max-width: min(28rem, 100%);
    margin: 0 0 36px;
  }

  /* ── Auth buttons ── */
  .landing-auth-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .landing-auth-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    border-radius: 14px;
    background: var(--glass-medium);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .landing-auth-btn:hover {
    transform: scale(1.03);
    background: var(--glass-heavy, rgba(255, 255, 255, 0.12));
    box-shadow: 0 0 24px rgba(255, 77, 77, 0.15);
  }
  .landing-auth-btn:active { transform: scale(0.98); }
  .landing-auth-btn.connected {
    border-color: rgba(76, 217, 100, 0.4);
    color: #4cd964;
    cursor: default;
  }
  .landing-auth-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .auth-icon {
    width: 20px;
    height: 20px;
  }

  .landing-trust {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  /* ── CTA (gradient button for "Start earning") ── */
  .landing-cta {
    width: fit-content;
    padding: 16px 48px;
    border-radius: 100px;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    border: none;
    color: white;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(255, 77, 77, 0.3);
    transition: transform 0.15s, opacity 0.15s;
    margin-top: 20px;
  }
  .landing-cta:hover { transform: scale(1.03); }
  .landing-cta:active { transform: scale(0.97); }

  /* ── Value prop section label ── */
  .landing-section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 20px;
    width: 100%;
    max-width: 54rem;
  }

  /* ── Value prop cards ── */
  .landing-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding-bottom: max(48px, env(safe-area-inset-bottom, 48px));
    width: 100%;
    max-width: 54rem;
  }

  .landing-card {
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 28px 24px;
    opacity: 0;
    transform: translateY(16px);
    animation: card-in 0.5s ease forwards;
  }
  .landing-card:nth-child(1) { animation-delay: 0.1s; }
  .landing-card:nth-child(2) { animation-delay: 0.25s; }
  .landing-card:nth-child(3) { animation-delay: 0.4s; }

  @keyframes card-in {
    to { opacity: 1; transform: translateY(0); }
  }

  .landing-card-icon {
    color: var(--accent-tertiary);
    margin-bottom: 12px;
  }

  .landing-card-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 6px;
  }

  .landing-card-desc {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.55;
    margin: 0;
  }

  /* ── Auth card (post-click state) ── */
  .auth-card-wrapper {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 0;
  }

  .auth-card {
    background: var(--glass-medium);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 48px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 400px;
    width: 100%;
    animation: card-in 0.4s ease forwards;
  }

  .auth-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .auth-name {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .auth-card-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    margin-top: 8px;
  }

  .auth-card-buttons .landing-auth-btn {
    width: 100%;
    justify-content: center;
  }

  .auth-error {
    font-size: 13px;
    color: #ff6b6b;
    margin: 0;
    text-align: center;
  }

  .auth-hint {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    text-align: center;
  }

  .auth-skip-link {
    background: none;
    border: none;
    color: var(--accent-tertiary);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  /* ── Responsive ── */
  @media (max-width: 520px) {
    .landing-auth-buttons {
      flex-direction: column;
      width: 100%;
    }
    .landing-auth-btn {
      justify-content: center;
    }
    .auth-card {
      padding: 36px 24px;
      margin: 0 16px;
    }
  }

  @media (min-width: 768px) {
    .landing-cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
```

- [ ] **Step 2: Run dev server and verify styles**

Run: `npm run dev`

Verify:
- Hero is centered with generous whitespace
- Auth buttons are glass-panel with hover scale + glow
- Value prop cards fade in with stagger on scroll
- Auth card state (after clicking a button and returning from OAuth) shows avatar, connected state, and "Start earning" CTA
- Mobile: auth buttons stack, card is full-width with padding

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "style: add 21st.dev-inspired styles for landing hero, auth card, and value props"
```

---

### Task 3: Icon Assets

**Files:**
- Create: `static/icons/google.svg` (if missing)
- Create: `static/icons/instagram.svg` (if missing)

- [ ] **Step 1: Check for existing icons**

Run: `ls static/icons/google.svg static/icons/instagram.svg 2>&1`

If both exist, skip this task entirely.

- [ ] **Step 2: Create Google icon (if missing)**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
</svg>
```

- [ ] **Step 3: Create Instagram icon (if missing)**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="ig" x1="0" y1="24" x2="24" y2="0">
      <stop offset="0%" stop-color="#FD5"/>
      <stop offset="50%" stop-color="#FF543E"/>
      <stop offset="100%" stop-color="#C837AB"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig)" stroke-width="2"/>
  <circle cx="12" cy="12" r="5" stroke="url(#ig)" stroke-width="2"/>
  <circle cx="18" cy="6" r="1.5" fill="url(#ig)"/>
</svg>
```

- [ ] **Step 4: Commit**

```bash
git add static/icons/
git commit -m "feat: add Google and Instagram SVG icons for auth buttons"
```

---

### Task 4: Auth Redirect Configuration

**Files:**
- Modify: `src/routes/auth/google/+server.ts` (add `redirect` query param support)
- Modify: `src/routes/auth/instagram/+server.ts` (add `redirect` query param support)

The existing OAuth flows redirect back to `/onboarding`. We need them to support a `redirect` query param so they can send users back to `/` (the landing page) instead.

- [ ] **Step 1: Check current Google auth redirect behavior**

Run: `head -30 src/routes/auth/google/+server.ts`

Look at how `redirect_uri` and the callback URL are constructed. The callback route (`/auth/google/callback`) is what sets the `google_connected=1` param and redirects the user.

Run: `cat src/routes/auth/google/callback/+server.ts`

- [ ] **Step 2: Update Google callback to support custom redirect**

In the Google callback handler, find where it redirects to `/onboarding?google_connected=1`. Change it to read the `state` parameter (or a stored redirect) and redirect to that URL instead, defaulting to `/onboarding` for backwards compatibility.

The exact change depends on the current implementation — read the file first and adapt. The goal: `window.location` ends up at `/?google_connected=1` when the user started from the landing page.

- [ ] **Step 3: Update Instagram callback similarly**

Same pattern — the Instagram callback should redirect to `/?ig_connected=1&ig_rt=...` when the user started from the landing page.

- [ ] **Step 4: Test both flows**

Run: `npm run dev`

1. Open `http://localhost:5173`
2. Click "Continue with Google" — should redirect to Google OAuth → come back to `/?google_connected=1` → show auth card with Google connected
3. Click "Continue with Instagram" — same pattern

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth/
git commit -m "feat: support custom redirect in OAuth callbacks for landing page auth flow"
```

---

### Task 5: Earn Page Redesign

**Files:**
- Modify: `src/routes/(app)/earn/+page.svelte` (restructure template, keep data-fetching logic)

The existing earn page already has wallet, campaigns, rates, graph strength, identity intelligence, and visibility controls. We reshape the UI to lead with the spec's simpler status-driven layout: status banner → match stats → active campaigns → how it works.

- [ ] **Step 1: Read the full current earn page**

Run: `cat src/routes/(app)/earn/+page.svelte`

Understand the full template structure and all the data sources (campaigns, wallet, prefs, graphStrength, creatorRates, visibility, etc).

- [ ] **Step 2: Restructure the template**

Keep the entire `<script>` block and data-fetching logic unchanged. Rewrite the template to follow this order:

1. **Status banner** — uses `$profile.instagramConnected` and `graphStrength` to show "You're live in the marketplace" (green dot) or "Connect Instagram to start earning"
2. **Match stats row** — three glass cards showing:
   - "Profile views" — from `graphStrength?.source_count` or campaigns length as proxy
   - "Matches this week" — from `campaigns.length`
   - "Lifetime earnings" — from `wallet?.summary?.total_inr ?? 0`
3. **Active campaigns** — reuse existing `OfferCard` component for each campaign, with empty state: "No campaigns yet. We're finding brands that match your vibe."
4. **How it works** — three-step minimal explainer using same Phosphor icons as landing (MagnetStraight, Lightning, ChartLineUp)

Move the existing advanced sections (identity intelligence, rate card, visibility controls, portrait preview) below these, under a "Details" section divider. Don't remove them — they're useful for power users.

```svelte
<div class="earn-page">
  <!-- Status banner -->
  <div class="earn-status" class:live={$profile.instagramConnected}>
    <div class="status-dot"></div>
    <span>
      {#if $profile.instagramConnected}
        You're live in the marketplace
      {:else}
        Connect Instagram to start earning
      {/if}
    </span>
  </div>

  <!-- Match stats -->
  <div class="earn-stats">
    <div class="earn-stat-card">
      <span class="stat-value">{graphStrength?.source_count ?? 0}</span>
      <span class="stat-label">Profile views from brands</span>
    </div>
    <div class="earn-stat-card">
      <span class="stat-value">{campaigns.length}</span>
      <span class="stat-label">Matches this week</span>
    </div>
    <div class="earn-stat-card">
      <span class="stat-value">₹{wallet?.summary?.total_inr ?? 0}</span>
      <span class="stat-label">Lifetime earnings</span>
    </div>
  </div>

  <!-- Active campaigns -->
  <div class="earn-section">
    <h2 class="earn-section-title">Active campaigns</h2>
    {#if campaigns.length === 0}
      <div class="earn-empty">
        <p>No campaigns yet. We're finding brands that match your vibe.</p>
      </div>
    {:else}
      <div class="earn-campaign-list">
        {#each campaigns as c (c.campaign_id)}
          <OfferCard
            brandName={c.brand_name}
            title={c.title}
            creativeText={c.creative_text}
            rewardInr={c.reward_inr}
            matchReason={c.match_reason}
            matchScore={c.match_score}
          />
        {/each}
      </div>
    {/if}
  </div>

  <!-- How it works -->
  <div class="earn-section">
    <h2 class="earn-section-title">How it works</h2>
    <div class="earn-steps">
      <div class="earn-step">
        <div class="step-icon"><MagnetStraight size={24} weight="duotone" /></div>
        <div>
          <h3 class="step-title">We match you</h3>
          <p class="step-desc">Brands are paired with you based on your identity and aesthetic.</p>
        </div>
      </div>
      <div class="earn-step">
        <div class="step-icon"><Lightning size={24} weight="duotone" /></div>
        <div>
          <h3 class="step-title">You approve & post</h3>
          <p class="step-desc">Review the brief, approve the content, and it goes live.</p>
        </div>
      </div>
      <div class="earn-step">
        <div class="step-icon"><ChartLineUp size={24} weight="duotone" /></div>
        <div>
          <h3 class="step-title">We report, you earn</h3>
          <p class="step-desc">Analytics sent to the brand automatically. You get paid.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Advanced details (existing components, moved below) -->
  <div class="earn-section">
    <h2 class="earn-section-title">Details</h2>
    <!-- Keep existing: RateCard, IntegrityScore, VisibilityControls, PortraitPreview, IdentityIntelligencePanel -->
    <!-- ... existing template code for these sections ... -->
  </div>
</div>
```

- [ ] **Step 3: Add imports for Phosphor icons**

Add to the script block:

```typescript
import MagnetStraight from 'phosphor-svelte/lib/MagnetStraight';
import Lightning from 'phosphor-svelte/lib/Lightning';
import ChartLineUp from 'phosphor-svelte/lib/ChartLineUp';
```

- [ ] **Step 4: Add styles for the new earn layout**

```css
.earn-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 20px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

.earn-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: var(--glass-light);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
}
.earn-status.live { color: var(--text-primary); }
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}
.earn-status.live .status-dot {
  background: #4cd964;
  box-shadow: 0 0 8px rgba(76, 217, 100, 0.5);
}

.earn-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.earn-stat-card {
  background: var(--glass-light);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.earn-section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin: 0 0 16px;
}

.earn-empty {
  background: var(--glass-light);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 32px 20px;
  text-align: center;
}
.earn-empty p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.earn-campaign-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.earn-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.earn-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--glass-light);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
}

.step-icon {
  color: var(--accent-tertiary);
  flex-shrink: 0;
  margin-top: 2px;
}

.step-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.step-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 520px) {
  .earn-stats {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run dev server and verify earn page**

Run: `npm run dev`

Navigate to `/earn` (must be logged in). Verify:
- Status banner shows "You're live in the marketplace" with green dot (if IG connected)
- Three stat cards render (even if values are 0)
- Campaign list shows empty state or real campaigns
- "How it works" section shows three steps with icons
- Existing advanced sections (rates, identity, visibility) appear below

- [ ] **Step 6: Commit**

```bash
git add src/routes/\(app\)/earn/+page.svelte
git commit -m "feat: redesign earn page with status banner, match stats, and how-it-works section"
```

---

### Task 6: Clean Up Old Onboarding References

**Files:**
- Modify: `src/routes/+page.svelte` — remove `ProductPreviewCard` import (no longer used)
- Keep: `src/routes/onboarding/+page.svelte` — do NOT delete. Keep as fallback for deep links and edge cases. Users with `?redirect=/onboarding` in OAuth flows should still land somewhere.

- [ ] **Step 1: Remove unused import**

In `src/routes/+page.svelte`, remove the line:
```
import ProductPreviewCard from '$lib/components/onboarding/ProductPreviewCard.svelte';
```

- [ ] **Step 2: Update sessionGate fallback**

In `src/lib/auth/sessionGate.ts`, the `invalidateAndGoToOnboarding()` function sends users to `/onboarding`. Update it to send to `/` instead (the new landing page with inline auth):

Change line 41:
```typescript
  void goto('/onboarding', { replaceState: true });
```
to:
```typescript
  void goto('/', { replaceState: true });
```

- [ ] **Step 3: Verify no broken references**

Run: `grep -r "goto.*onboarding" src/ --include="*.svelte" --include="*.ts" -l`

Review each result. The onboarding page itself can reference `/onboarding` (it's self-referential). Any other files sending users to `/onboarding` should be updated to send to `/` instead.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/lib/auth/sessionGate.ts
git commit -m "chore: clean up old onboarding references, redirect invalidated sessions to landing page"
```

---

### Task 7: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Fresh user flow**

1. Clear localStorage (`localStorage.clear()` in console)
2. Open `http://localhost:5173`
3. Verify landing hero with "Post. Get paid." headline
4. Verify three value-prop cards below fold
5. Click "Continue with Google" → OAuth flow → returns to `/?google_connected=1`
6. Auth card appears with profile picture and name
7. Instagram button pulses / is available to connect
8. Click "skip for now" → redirects to `/home`

- [ ] **Step 2: Returning user flow**

1. Close and reopen `http://localhost:5173`
2. Should auto-redirect to `/home` (session is valid)

- [ ] **Step 3: Earn page flow**

1. Navigate to `/earn` via bottom nav
2. Status banner shows correct state
3. Stats render (0 is fine)
4. Empty state message for campaigns
5. "How it works" section renders

- [ ] **Step 4: Mobile responsive check**

1. Open Chrome DevTools → toggle device toolbar
2. Check landing page at 375px width — buttons stack, hero is readable
3. Check earn page at 375px — stat cards stack

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
