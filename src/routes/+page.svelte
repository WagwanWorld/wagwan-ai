<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import {
    isAppSessionValid,
    maybeRepairIgOnlyAccountKey,
  } from '$lib/auth/sessionGate';
  import { primaryAccountKeyFromOAuthState } from '$lib/auth/accountKey';
  import type { InstagramIdentity } from '$lib/server/instagram';
  import type { GoogleIdentity } from '$lib/utils';
  import MagnetStraight from 'phosphor-svelte/lib/MagnetStraight';
  import Lightning from 'phosphor-svelte/lib/Lightning';
  import ChartLineUp from 'phosphor-svelte/lib/ChartLineUp';
  import Check from 'phosphor-svelte/lib/Check';

  let visible = false;
  let g1: HTMLDivElement, g2: HTMLDivElement, g3: HTMLDivElement;
  let raf: number;
  let shouldShowLanding = false;

  // ── Auth state ──
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
    window.location.href = '/auth/google?from=landing';
  }

  function startInstagram() {
    authStarted = true;
    igConnecting = true;
    window.location.href = '/auth/instagram?from=landing';
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
            body: JSON.stringify({ googleSub: repaired.googleSub, profile: repaired, tokens: {} }),
          }).catch(() => {});
        }
        if (isAppSessionValid(get(profile))) {
          goto('/home', { replaceState: true });
          return;
        }
      }
    } catch {}

    shouldShowLanding = true;

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

    setTimeout(() => { visible = true; startGradient(); }, 60);
  });

  onDestroy(() => { if (raf) cancelAnimationFrame(raf); });
</script>

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
                Connecting...
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
                Connecting...
              {:else}
                <img src="/icons/instagram.svg" alt="" class="auth-icon" /> Continue with Instagram
              {/if}
            </button>
          </div>

          {#if authError}
            <p class="auth-error">{authError}</p>
          {/if}

          {#if googleConnected && igConnected}
            <button class="landing-cta" on:click={finishSetup} disabled={finishing}>
              {#if finishing}Saving...{:else}Start earning{/if}
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

<style>
  .landing-root {
    position: fixed; inset: 0;
    background: var(--bg-primary);
    overflow-y: auto;
    scrollbar-width: none;
    font-family: var(--font-sans);
  }

  /* ── Gradient backdrop ── */
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
  .landing-auth-btn:disabled:hover {
    transform: none;
    box-shadow: none;
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

  /* ── CTA ── */
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
  .landing-cta:disabled { opacity: 0.7; cursor: default; }

  /* ── Section label ── */
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
