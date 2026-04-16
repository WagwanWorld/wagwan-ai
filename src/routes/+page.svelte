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
  let canvas: HTMLCanvasElement;
  let particleRaf: number;
  let cardsVisible = false;
  let cardsEl: HTMLDivElement;

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

  // ── Mesh gradient animation (faster + more dramatic) ──
  function startGradient() {
    function tick(ts: number) {
      const t = ts * 0.001;
      if (g1) {
        const x = Math.sin(t * 0.15) * 28 + Math.sin(t * 0.32) * 14;
        const y = Math.cos(t * 0.12) * 24 + Math.cos(t * 0.24) * 10;
        g1.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g2) {
        const x = Math.sin(t * 0.24 + 1.3) * 34 + Math.cos(t * 0.41) * 16;
        const y = Math.cos(t * 0.18 + 0.8) * 28 + Math.sin(t * 0.29) * 12;
        g2.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g3) {
        const x = Math.sin(t * 0.08 + 0.5) * 18 + Math.cos(t * 0.12) * 10;
        const y = Math.cos(t * 0.065 + 1.2) * 20 + Math.sin(t * 0.11) * 8;
        g3.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  // ── Floating particles ──
  interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number }

  function startParticles() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx!.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.4 + 0.1),
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.3 + 0.1,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = window.innerHeight + 10; p.x = Math.random() * window.innerWidth; }
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 77, 77, ${p.a})`;
        ctx!.fill();
      }
      particleRaf = requestAnimationFrame(draw);
    }
    draw();
  }

  // ── Scroll-triggered card reveal ──
  function observeCards() {
    if (!cardsEl) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          cardsVisible = true;
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(cardsEl);
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

    setTimeout(() => {
      visible = true;
      startGradient();
      startParticles();
      observeCards();
    }, 60);
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    if (particleRaf) cancelAnimationFrame(particleRaf);
  });
</script>

{#if shouldShowLanding}
<div class="landing-root">
  <!-- Mesh gradient background -->
  <div class="landing-grad" class:ready={visible}>
    <div class="landing-g landing-g--a mesh-animate" bind:this={g1}></div>
    <div class="landing-g landing-g--b mesh-animate" bind:this={g2}></div>
    <div class="landing-g landing-g--c mesh-animate" bind:this={g3}></div>
  </div>

  <!-- Floating particles -->
  <canvas class="landing-particles" bind:this={canvas}></canvas>

  <div class="landing-content" class:ready={visible}>
    {#if !authStarted}
      <nav class="landing-nav">
        <img src="/logo-black.svg" alt="WagwanAI" class="landing-logo-img" />
      </nav>

      <div class="landing-hero">
        <h1 class="landing-h1">
          <span class="shimmer-text">Post. Get paid.</span><br>
          <span class="shimmer-text shimmer-text--delay">Your AI handles the&nbsp;rest.</span>
        </h1>
        <p class="landing-sub">
          Wagwan matches you with brands, auto-posts your content, and handles analytics. You just keep being you.
        </p>
        <div class="landing-auth-buttons">
          <button class="landing-auth-btn glow-breathe" on:click={startGoogle}>
            <img src="/icons/google.svg" alt="" class="auth-icon" />
            Continue with Google
          </button>
          <button class="landing-auth-btn glow-breathe glow-breathe--delay" on:click={startInstagram}>
            <img src="/icons/instagram.svg" alt="" class="auth-icon" />
            Continue with Instagram
          </button>
        </div>
        <p class="landing-trust" class:ready={visible}>Join micro-creators already earning</p>
      </div>

      <div class="landing-section-label">How it works</div>

      <div class="landing-cards" bind:this={cardsEl} class:cards-visible={cardsVisible}>
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

  /* ── Mesh gradient (more vivid) ── */
  .landing-grad {
    position: fixed; inset: 0;
    opacity: 0;
    transition: opacity 1.5s ease;
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
    width: 120vw; height: 120vw;
    left: 25%; top: 15%;
    background: radial-gradient(ellipse at center, oklch(60% 0.28 25 / 0.14) 0%, transparent 65%);
    filter: blur(80px);
  }
  .landing-g--b {
    width: 90vw; height: 90vw;
    left: 65%; top: 60%;
    background: radial-gradient(ellipse at center, oklch(55% 0.22 260 / 0.12) 0%, transparent 65%);
    filter: blur(70px);
  }
  .landing-g--c {
    width: 140vw; height: 140vw;
    left: 45%; top: 40%;
    background: radial-gradient(ellipse at center, oklch(72% 0.20 80 / 0.12) 0%, transparent 68%);
    filter: blur(90px);
  }

  /* ── Floating particles canvas ── */
  .landing-particles {
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.6;
  }

  /* ── Content wrapper ── */
  .landing-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: env(safe-area-inset-top, 0px) 28px env(safe-area-inset-bottom, 28px);
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s;
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
    height: 20px;
    width: auto;
    opacity: 0.8;
  }

  /* ── Hero ── */
  .landing-hero {
    min-height: 72dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 48px 0 32px;
    max-width: 680px;
  }

  .landing-h1 {
    font-family: var(--font-sans);
    font-size: clamp(38px, 11vw, 64px);
    font-weight: 800;
    line-height: 1.06;
    letter-spacing: -0.035em;
    color: var(--text-primary);
    margin: 0 0 24px;
  }

  /* ── Shimmer gradient text ── */
  .shimmer-text {
    display: inline-block;
    background: linear-gradient(
      90deg,
      var(--text-primary) 0%,
      var(--text-primary) 40%,
      #FF4D4D 50%,
      #FFB84D 55%,
      var(--text-primary) 60%,
      var(--text-primary) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3s ease-in-out infinite;
  }
  .shimmer-text--delay {
    animation-delay: 0.4s;
  }

  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  .landing-sub {
    font-size: 17px;
    color: var(--text-secondary);
    line-height: 1.7;
    max-width: min(28rem, 100%);
    margin: 0 0 40px;
  }

  /* ── Auth buttons with breathing glow ── */
  .landing-auth-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 28px;
  }

  .landing-auth-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    border-radius: 14px;
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    box-shadow: var(--shadow-tall-card);
  }
  .landing-auth-btn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: var(--shadow-card-hover);
    border-color: rgba(255, 77, 77, 0.25);
  }
  .landing-auth-btn:active { transform: scale(0.98); }
  .landing-auth-btn.connected {
    border-color: rgba(5, 150, 105, 0.4);
    color: #059669;
    cursor: default;
  }
  .landing-auth-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .landing-auth-btn:disabled:hover {
    transform: none;
    box-shadow: var(--shadow-tall-card);
  }

  /* Breathing glow animation */
  .glow-breathe {
    animation: breathe 2.8s ease-in-out infinite;
  }
  .glow-breathe--delay {
    animation-delay: 1.4s;
  }

  @keyframes breathe {
    0%, 100% { box-shadow: var(--shadow-tall-card); }
    50% { box-shadow: 0 4px 28px rgba(255, 77, 77, 0.18), 0 0 0 1px rgba(255, 77, 77, 0.08); }
  }

  .auth-icon {
    width: 20px;
    height: 20px;
  }

  /* ── Trust line (delayed fade-in) ── */
  .landing-trust {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    opacity: 0;
    transition: opacity 1s ease 1.2s;
  }
  .landing-trust.ready {
    opacity: 1;
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
    transition: transform 0.2s, box-shadow 0.2s;
    margin-top: 20px;
  }
  .landing-cta:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 8px 32px rgba(255, 77, 77, 0.4);
  }
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

  /* ── Value prop cards (scroll-triggered) ── */
  .landing-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding-bottom: max(48px, env(safe-area-inset-bottom, 48px));
    width: 100%;
    max-width: 54rem;
  }

  .landing-card {
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
    border-radius: 18px;
    padding: 28px 24px;
    box-shadow: var(--shadow-tall-card);
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.6s ease, transform 0.6s ease, box-shadow 0.2s ease;
  }
  .landing-card:hover {
    box-shadow: var(--shadow-card-hover);
  }

  /* Scroll-triggered stagger */
  .cards-visible .landing-card {
    opacity: 1;
    transform: translateY(0);
  }
  .cards-visible .landing-card:nth-child(1) { transition-delay: 0s; }
  .cards-visible .landing-card:nth-child(2) { transition-delay: 0.15s; }
  .cards-visible .landing-card:nth-child(3) { transition-delay: 0.3s; }

  .landing-card-icon {
    color: var(--accent-primary);
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
    background: var(--glass-strong, var(--glass-medium));
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding: 48px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 400px;
    width: 100%;
    box-shadow: var(--shadow-tall-card);
    animation: card-rise 0.5s ease forwards;
  }

  @keyframes card-rise {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .auth-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-subtle);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
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
    animation: none;
  }

  .auth-error {
    font-size: 13px;
    color: #e11d48;
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
    color: var(--accent-primary);
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
