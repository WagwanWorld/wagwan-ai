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
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';

  let visible = false;
  let shouldShowLanding = false;
  let canvas: HTMLCanvasElement;
  let particleRaf: number;
  let g1: HTMLDivElement, g2: HTMLDivElement;
  let gradRaf: number;

  // ── Auth state (Instagram only) ──
  let igConnected = false;
  let igConnecting = false;
  let igIdentity: InstagramIdentity | null = null;
  let igToken = '';
  let authError = '';
  let finishing = false;

  // ── Live activity feed ──
  const feedMessages = [
    { text: 'Arjun in Mumbai just got matched with', brand: 'Razorpay' },
    { text: 'Priya earned', brand: '₹8,200 this week' },
    { text: 'Sneha in Bangalore matched with', brand: 'CRED' },
    { text: 'Maya completed her', brand: '12th brand deal' },
    { text: 'Karthik just got paid', brand: '₹18,300' },
    { text: 'Rohan in Delhi matched with', brand: 'Zerodha' },
  ];
  let feedIndex = 0;
  let feedVisible = true;
  let feedInterval: ReturnType<typeof setInterval>;

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

  function startInstagram() {
    igConnecting = true;
    window.location.href = '/auth/instagram?from=landing';
  }

  async function finishSetup() {
    finishing = true;
    authError = '';

    const accountSub = primaryAccountKeyFromOAuthState({
      googleConnected: false,
      googleIdentity: null,
      igConnected,
      igIdentity,
    });
    if (!accountSub) {
      authError = 'Could not determine your account. Try connecting again.';
      finishing = false;
      return;
    }

    const name = igIdentity?.displayName || '';
    const city = igIdentity?.city || '';
    const interests = igIdentity?.interests?.length
      ? igIdentity.interests
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
      googleConnected: false,
      googleIdentity: null,
      googleAccessToken: '',
      googleRefreshToken: '',
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

  // ── Mesh gradient animation ──
  function startGradient() {
    function tick(ts: number) {
      const t = ts * 0.001;
      if (g1) {
        const x = Math.sin(t * 0.08) * 12;
        const y = Math.cos(t * 0.06) * 10;
        g1.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g2) {
        const x = Math.sin(t * 0.1 + 1.5) * 14;
        const y = Math.cos(t * 0.07 + 0.8) * 12;
        g2.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      gradRaf = requestAnimationFrame(tick);
    }
    gradRaf = requestAnimationFrame(tick);
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
    for (let i = 0; i < 25; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(Math.random() * 0.2 + 0.05),
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.12 + 0.03,
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
        ctx!.fillStyle = `rgba(255, 255, 255, ${p.a})`;
        ctx!.fill();
      }
      particleRaf = requestAnimationFrame(draw);
    }
    draw();
  }

  onMount(() => {
    // Check existing session
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

    // Handle Instagram callback
    const params = new URL(window.location.href).searchParams;
    if (params.get('ig_connected') === '1') {
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
              // Auto-proceed to dashboard
              await finishSetup();
            } else {
              authError = 'Could not load Instagram profile — try again.';
              igConnected = false;
            }
          })
          .catch(() => {
            authError = 'Instagram connection failed.';
            igConnected = false;
          });
      } else {
        authError = 'Instagram could not finish. Try again.';
      }
    }

    // Restore saved auth state
    try {
      const savedIg = localStorage.getItem('onboarding_ig');
      if (savedIg) {
        igIdentity = JSON.parse(savedIg);
        igConnected = true;
      }
      const savedIgToken = localStorage.getItem('onboarding_ig_token');
      if (savedIgToken) igToken = savedIgToken;
    } catch {}

    // Live feed rotation
    feedInterval = setInterval(() => {
      feedVisible = false;
      setTimeout(() => {
        feedIndex = (feedIndex + 1) % feedMessages.length;
        feedVisible = true;
      }, 400);
    }, 3500);

    setTimeout(() => {
      visible = true;
      startGradient();
      startParticles();
    }, 60);
  });

  onDestroy(() => {
    if (gradRaf) cancelAnimationFrame(gradRaf);
    if (particleRaf) cancelAnimationFrame(particleRaf);
    if (feedInterval) clearInterval(feedInterval);
  });
</script>

{#if shouldShowLanding}
<div class="landing-root" data-app-chrome="dark">
  <!-- Mesh gradient — restrained -->
  <div class="landing-grad" class:ready={visible}>
    <div class="landing-g landing-g--warm" bind:this={g1}></div>
    <div class="landing-g landing-g--cool" bind:this={g2}></div>
  </div>

  <!-- Film grain -->
  <div class="grain" class:ready={visible}></div>

  <!-- Particles -->
  <canvas class="landing-particles" bind:this={canvas}></canvas>

  <div class="landing-content" class:ready={visible}>
    <!-- Nav -->
    <nav class="hero-nav">
      <img src="/logo-white.svg" alt="WagwanAI" class="hero-logo" />
      <span class="nav-pill">For creators</span>
    </nav>

    <!-- Center — headline + CTA -->
    <div class="hero-center">
      <h1 class="hero-h1">
        Get matched with brands.<br>
        <span class="gradient-phrase">Get paid weekly.</span><br>
        Skip the&nbsp;DMs.
      </h1>

      <p class="hero-sub">
        Wagwan finds brands whose audiences match yours, drafts the content,
        and handles payouts. You approve everything before it goes live.
      </p>

      {#if igConnecting}
        <button class="ig-btn ig-btn--loading" disabled>
          <span class="ig-spinner"></span>
          Connecting...
        </button>
      {:else if authError}
        <button class="ig-btn" on:click={startInstagram}>
          <InstagramLogo size={20} weight="bold" />
          Try again with Instagram
        </button>
        <p class="auth-error">{authError}</p>
      {:else}
        <button class="ig-btn" on:click={startInstagram}>
          <InstagramLogo size={20} weight="bold" />
          Continue with Instagram
        </button>
      {/if}

      <p class="trust-line">
        We see your public profile and insights. Never your DMs or password.
      </p>

      <!-- Live activity ticker -->
      <div class="feed-ticker" class:feed-show={feedVisible}>
        <div class="feed-dot"></div>
        <span>{feedMessages[feedIndex].text} <strong>{feedMessages[feedIndex].brand}</strong></span>
      </div>
    </div>

    <!-- Bottom bar — stats + how it works -->
    <div class="hero-bottom">
      <div class="stats-row">
        <span class="stat"><strong>2,400+</strong> creators</span>
        <span class="stat-sep">/</span>
        <span class="stat"><strong>₹14L+</strong> paid out</span>
        <span class="stat-sep">/</span>
        <span class="stat"><strong>180+</strong> brands</span>
      </div>

      <div class="how-row">
        <div class="how-item">
          <span class="how-num">01</span>
          <div>
            <div class="how-title">Brands find you</div>
            <div class="how-desc">Based on your vibe, not your follower count.</div>
          </div>
        </div>
        <div class="how-sep"></div>
        <div class="how-item">
          <span class="how-num">02</span>
          <div>
            <div class="how-title">Content drafted for you</div>
            <div class="how-desc">You approve before posting. Always.</div>
          </div>
        </div>
        <div class="how-sep"></div>
        <div class="how-item">
          <span class="how-num">03</span>
          <div>
            <div class="how-title">We handle the receipts</div>
            <div class="how-desc">Analytics sent to brands. You don't touch a thing.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
{:else}
<div class="loading-shell">
  <div class="loading-mark">✦</div>
</div>
{/if}

<style>
  /* ══════════════════════════════════════════════════════════
     ROOT
     ══════════════════════════════════════════════════════════ */
  .landing-root {
    position: fixed; inset: 0;
    background: #0F0F11;
    overflow: hidden;
    font-family: 'Geist Variable', 'Inter', -apple-system, sans-serif;
    color: #EDEDEF;
  }

  /* ── Mesh gradient — very restrained ── */
  .landing-grad {
    position: fixed; inset: 0;
    opacity: 0; transition: opacity 2s ease;
    pointer-events: none; z-index: 0;
  }
  .landing-grad.ready { opacity: 1; }
  .landing-g {
    position: absolute; border-radius: 50%;
    will-change: transform; transform: translate(-50%, -50%);
  }
  .landing-g--warm {
    width: 110vw; height: 110vw; left: 20%; top: 10%;
    background: radial-gradient(ellipse at center, oklch(50% 0.20 25 / 0.10) 0%, transparent 55%);
    filter: blur(120px);
  }
  .landing-g--cool {
    width: 90vw; height: 90vw; left: 70%; top: 60%;
    background: radial-gradient(ellipse at center, oklch(45% 0.18 260 / 0.07) 0%, transparent 55%);
    filter: blur(120px);
  }

  /* ── Film grain ── */
  .grain {
    position: fixed; inset: 0; z-index: 1;
    pointer-events: none;
    opacity: 0; transition: opacity 2s ease;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    mix-blend-mode: overlay;
  }
  .grain.ready { opacity: 0.5; }

  /* ── Particles ── */
  .landing-particles {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 2;
    opacity: 0.35;
  }

  /* ══════════════════════════════════════════════════════════
     CONTENT LAYOUT — full viewport, flex column
     ══════════════════════════════════════════════════════════ */
  .landing-content {
    position: relative; z-index: 3;
    display: flex; flex-direction: column;
    height: 100dvh;
    padding: 0 clamp(24px, 6vw, 80px);
    opacity: 0; transform: translateY(8px);
    transition: opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s;
  }
  .landing-content.ready { opacity: 1; transform: translateY(0); }

  /* ── Nav ── */
  .hero-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: max(24px, env(safe-area-inset-top, 24px)) 0 0;
    flex-shrink: 0;
  }
  .hero-logo { height: 16px; opacity: 0.5; }
  .nav-pill {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.1em; color: #3A3A40;
    padding: 5px 12px;
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 100px;
  }

  /* ── Center block ── */
  .hero-center {
    flex: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    max-width: 620px;
    margin: 0 auto;
    padding-bottom: 24px;
  }

  /* ── Headline ── */
  .hero-h1 {
    font-family: 'Geist Variable', 'Inter', -apple-system, sans-serif;
    font-size: clamp(32px, 5.5vw, 52px);
    font-weight: 750;
    line-height: 1.1;
    letter-spacing: -0.04em;
    color: #EDEDEF;
    margin: 0 0 24px;
  }

  .gradient-phrase {
    background: linear-gradient(135deg, #E87FA8 0%, #E8833A 55%, #D9C26E 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* ── Subhead ── */
  .hero-sub {
    font-size: clamp(14px, 1.8vw, 16px);
    line-height: 1.65;
    color: #6A6A72;
    max-width: 420px;
    margin: 0 0 36px;
    font-weight: 400;
  }

  /* ══════════════════════════════════════════════════════════
     INSTAGRAM BUTTON
     ══════════════════════════════════════════════════════════ */
  .ig-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; max-width: 340px;
    height: 52px; padding: 0 32px;
    border: none; border-radius: 13px;
    background: linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 80%, #515BD4 100%);
    color: #fff; font-size: 15px; font-weight: 600;
    font-family: inherit; cursor: pointer;
    box-shadow: 0 4px 32px rgba(221, 42, 123, 0.20);
    transition: transform 0.25s ease, box-shadow 0.4s ease;
    position: relative; overflow: hidden;
  }
  .ig-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%);
    opacity: 0; transition: opacity 0.3s ease;
  }
  .ig-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 40px rgba(221, 42, 123, 0.28), 0 0 60px rgba(221, 42, 123, 0.08);
  }
  .ig-btn:hover::before { opacity: 1; }
  .ig-btn:active { transform: scale(0.985); }

  .ig-btn--loading {
    opacity: 0.7; cursor: default;
  }
  .ig-btn--loading:hover { transform: none; box-shadow: 0 4px 32px rgba(221, 42, 123, 0.20); }
  .ig-btn--loading:hover::before { opacity: 0; }

  .ig-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Auth error ── */
  .auth-error {
    font-size: 12px; color: #fb7185;
    margin: 12px 0 0; text-align: center;
  }

  /* ── Trust line ── */
  .trust-line {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px; color: #3A3A40;
    margin: 16px 0 0; letter-spacing: 0.01em;
    font-weight: 400;
  }

  /* ── Live activity ticker ── */
  .feed-ticker {
    display: flex; align-items: center; gap: 8px;
    margin: 24px 0 0;
    font-size: 12px; color: #4A4A50;
    opacity: 0; transform: translateY(4px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
  .feed-ticker.feed-show { opacity: 1; transform: translateY(0); }
  .feed-ticker strong { color: #8A8A90; font-weight: 600; }
  .feed-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #4ade80; flex-shrink: 0;
    box-shadow: 0 0 6px rgba(74, 222, 128, 0.35);
    animation: pulse-dot 2.5s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ══════════════════════════════════════════════════════════
     BOTTOM BAR
     ══════════════════════════════════════════════════════════ */
  .hero-bottom {
    flex-shrink: 0;
    padding: 0 0 max(28px, env(safe-area-inset-bottom, 28px));
    display: flex; flex-direction: column; gap: 20px;
    border-top: 1px solid rgba(255,255,255,0.03);
    padding-top: 20px;
  }

  /* Stats */
  .stats-row {
    display: flex; align-items: center; gap: 10px;
    font-size: 11px; color: #3A3A40;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  }
  .stat strong { color: #5A5A62; font-weight: 600; }
  .stat-sep { color: #2A2A30; font-weight: 300; }

  /* How it works — row */
  .how-row {
    display: flex; align-items: flex-start; gap: 0;
  }
  .how-item {
    display: flex; align-items: flex-start; gap: 12px;
    flex: 1;
    padding: 0 20px;
  }
  .how-item:first-child { padding-left: 0; }
  .how-item:last-child { padding-right: 0; }
  .how-sep {
    width: 1px; height: 36px;
    background: rgba(255,255,255,0.04);
    flex-shrink: 0; margin-top: 2px;
  }
  .how-num {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px; font-weight: 500;
    color: #2A2A30; flex-shrink: 0;
    margin-top: 2px;
  }
  .how-title {
    font-size: 13px; font-weight: 600; color: #8A8A90;
    margin-bottom: 3px;
  }
  .how-desc {
    font-size: 11px; color: #4A4A50; line-height: 1.5;
    font-weight: 400;
  }

  /* ── Loading shell ── */
  .loading-shell {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: #0F0F11;
  }
  .loading-mark {
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, #E87FA8, #E8833A);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; color: #fff;
    animation: mark-pulse 2s ease-in-out infinite;
  }
  @keyframes mark-pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE
     ══════════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .landing-content { padding: 0 24px; }

    .hero-nav { padding: max(16px, env(safe-area-inset-top, 16px)) 0 0; }
    .nav-pill { font-size: 9px; padding: 4px 10px; }

    .hero-h1 { font-size: 32px; margin-bottom: 18px; }
    .hero-sub { font-size: 14px; margin-bottom: 28px; max-width: 320px; }

    .ig-btn {
      max-width: 100%; height: 56px;
      border-radius: 14px; font-size: 15px;
    }

    .trust-line { font-size: 10px; }
    .feed-ticker { font-size: 11px; margin-top: 20px; }

    .hero-bottom { gap: 16px; padding-top: 16px; }
    .stats-row { font-size: 10px; gap: 8px; flex-wrap: wrap; }

    /* Stack how-it-works vertically on mobile */
    .how-row {
      flex-direction: column; gap: 14px;
    }
    .how-sep { display: none; }
    .how-item { padding: 0; }
  }

  /* ── Very small screens ── */
  @media (max-width: 380px) {
    .hero-h1 { font-size: 28px; }
    .hero-sub { font-size: 13px; }
  }
</style>
