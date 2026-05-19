<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { profile } from '$lib/stores/profile';
  import { primaryAccountKeyFromOAuthState } from '$lib/auth/accountKey';
  import type { InstagramIdentity } from '$lib/server/instagram';
  import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
  import Briefcase from 'phosphor-svelte/lib/Briefcase';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';
  import Lightning from 'phosphor-svelte/lib/Lightning';
  import MagnetStraight from 'phosphor-svelte/lib/MagnetStraight';
  import PaperPlaneTilt from 'phosphor-svelte/lib/PaperPlaneTilt';
  import Wallet from 'phosphor-svelte/lib/Wallet';

  export let data: {
    creators?: Array<{
      name: string;
      handle: string;
      profilePicture: string;
      followers: number;
      city: string;
      aesthetic: string;
      archetype: string;
      categories: string[];
    }>;
  } = { creators: [] };

  $: creators = data?.creators ?? [];

  type Role = 'creator' | 'brand';

  /* ── UI state ─────────────────────────────────────────────── */
  let visible = false;
  let reducedMotion = false;
  let phase: 'choice' | 'transitioning' | 'world' = 'choice';
  let role: Role = 'creator';

  /* ── Auth state ───────────────────────────────────────────── */
  let igConnecting = false;
  let finishing = false;
  let authError = '';
  let igIdentity: InstagramIdentity | null = null;
  let igToken = '';

  const roleCopy: Record<
    Role,
    { title: string; teaser: string; body: string; cta: string; trust: string }
  > = {
    creator: {
      title: 'Get discovered by brands that match your signal.',
      teaser: 'Get discovered by brands that match your signal',
      body: 'Connect Instagram once. Wagwan turns public content, audience fit, city, aesthetic, and momentum into a creator profile brands can actually buy from.',
      cta: 'Connect creator Instagram',
      trust: 'Public profile and insights only. Never your password. Never your DMs.',
    },
    brand: {
      title: 'Find creators by culture fit, not follower count.',
      teaser: 'Find creators by culture fit, not follower count',
      body: 'Enter the brand portal to build briefs, discover creators, track approvals, collect proof, and turn campaign performance into a live operating system.',
      cta: 'Connect brand Instagram',
      trust: 'Brand sign-in uses a separate Instagram session for your brand account.',
    },
  };

  /* ── Actions ──────────────────────────────────────────────── */
  function pickRole(r: Role) {
    role = r;
    phase = 'transitioning';
    setTimeout(
      () => {
        phase = 'world';
      },
      reducedMotion ? 0 : 1200,
    );
  }

  function switchBack() {
    phase = 'choice';
    authError = '';
  }

  function readCookie(name: string): string | undefined {
    return document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.split('=')
      .slice(1)
      .join('=');
  }

  function clearCookie(name: string) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  function cleanParam(key: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState({}, '', url.toString());
  }

  function startCreatorInstagram() {
    igConnecting = true;
    authError = '';
    window.location.href = '/auth/instagram?from=join';
  }

  function startPrimaryAction() {
    if (role === 'creator') {
      startCreatorInstagram();
      return;
    }
    window.location.href = '/auth/brand-instagram';
  }

  async function finishCreatorSetup() {
    finishing = true;
    authError = '';

    const accountSub = primaryAccountKeyFromOAuthState({
      googleConnected: false,
      googleIdentity: null,
      igConnected: Boolean(igIdentity),
      igIdentity,
    });

    if (!accountSub) {
      authError = 'Could not determine your account. Try connecting Instagram again.';
      finishing = false;
      return;
    }

    const fullProfile = {
      googleSub: accountSub,
      name: igIdentity?.displayName || '',
      city: igIdentity?.city || '',
      interests: igIdentity?.interests?.length
        ? igIdentity.interests
        : ['Music', 'Food', 'Fitness', 'Nightlife'],
      budget: 'mid' as const,
      social: 'both' as const,
      intents: ['Discovering new things', 'Music & culture', 'Food & dining'],
      setupComplete: true,
      instagramConnected: Boolean(igIdentity),
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

    await goto('/home', { replaceState: true });
  }

  onMount(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const params = new URL(window.location.href).searchParams;

    if (params.get('ig_error')) {
      authError = params.get('ig_error') || 'Instagram connection failed.';
      cleanParam('ig_error');
      role = 'creator';
      phase = 'world';
    }

    if (params.get('ig_connected') === '1') {
      role = 'creator';
      phase = 'world';
      const redemptionToken = (params.get('ig_rt') || '').trim() || readCookie('ig_redemption');
      clearCookie('ig_redemption');
      cleanParam('ig_connected');
      cleanParam('ig_rt');

      if (!redemptionToken) {
        authError = 'Instagram could not finish. Try again.';
      } else {
        igConnecting = false;
        finishing = true;
        fetch(`/api/instagram/identity?token=${encodeURIComponent(redemptionToken)}`)
          .then(async (response) => {
            if (!response.ok) {
              authError = 'Could not load Instagram profile. Try connecting again.';
              finishing = false;
              return;
            }
            const data = (await response.json()) as {
              identity?: InstagramIdentity;
              accessToken?: string;
              token?: string;
            };
            if (!data.identity) {
              authError = 'Instagram profile was empty. Try connecting again.';
              finishing = false;
              return;
            }
            igIdentity = data.identity;
            igToken = data.accessToken || data.token || '';
            try {
              localStorage.setItem('onboarding_ig', JSON.stringify(igIdentity));
              if (igToken) localStorage.setItem('onboarding_ig_token', igToken);
            } catch {}

            void finishCreatorSetup();
          })
          .catch(() => {
            authError = 'Instagram connection failed.';
            finishing = false;
          });
      }
    }

    setTimeout(
      () => {
        visible = true;
      },
      reducedMotion ? 0 : 60,
    );
  });
</script>

<svelte:head>
  <title>Wagwan | Creators x Brands</title>
  <meta
    name="description"
    content="Wagwan connects creators and brands through culture fit, audience signal, and paid briefs. Choose your path."
  />
</svelte:head>

<main
  class="portal-page"
  class:ready={visible}
  class:brand-mode={role === 'brand' && phase !== 'choice'}
  class:reduced={reducedMotion}
  data-app-chrome="dark"
>
  <!-- Background layers -->
  <div class="orb orb--lime" aria-hidden="true"></div>
  <div class="orb orb--magenta" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>

  <!-- ═══════════ PHASE 1: CHOICE ═══════════ -->
  {#if phase === 'choice'}
    <div class="choice-screen" class:ready={visible}>
      <img src="/wagwan-logo-white.svg" alt="Wagwan" class="logo" />

      <h1 class="choice-headline">
        Every creator gets discovered.<br />Every brand finds culture fit.
      </h1>

      <div class="choice-cards">
        <button
          type="button"
          class="choice-card choice-card--creator"
          on:click={() => pickRole('creator')}
        >
          <span class="card-glow card-glow--lime" aria-hidden="true"></span>
          <span class="card-label">I am a Creator</span>
          <span class="card-teaser">{roleCopy.creator.teaser}</span>
        </button>

        <button
          type="button"
          class="choice-card choice-card--brand"
          on:click={() => pickRole('brand')}
        >
          <span class="card-glow card-glow--magenta" aria-hidden="true"></span>
          <span class="card-label">I am a Brand</span>
          <span class="card-teaser">{roleCopy.brand.teaser}</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- ═══════════ PHASE 2: TRANSITIONING ═══════════ -->
  {#if phase === 'transitioning'}
    <div
      class="transition-overlay"
      class:creator={role === 'creator'}
      class:brand={role === 'brand'}
    >
      <div class="transition-fill"></div>
    </div>
  {/if}

  <!-- ═══════════ PHASE 3: WORLD ═══════════ -->
  {#if phase === 'world'}
    <div class="world-screen" class:brand={role === 'brand'}>
      <nav class="world-nav">
        <div class="nav-left">
          <img src="/wagwan-logo-white.svg" alt="Wagwan" class="nav-logo" />
          <span class="role-pill" class:brand={role === 'brand'}>
            {role === 'creator' ? 'Creator' : 'Brand'}
          </span>
        </div>
        <button type="button" class="switch-link" on:click={switchBack}>Switch</button>
      </nav>

      <!-- Asymmetric hero: copy left, preview right -->
      <section class="hero-split">
        <div class="hero-copy stagger-1">
          <h2 class="world-title">{roleCopy[role].title}</h2>
          <p class="world-body">{roleCopy[role].body}</p>

          <div class="world-cta">
            <button
              type="button"
              class="primary-action"
              class:brand={role === 'brand'}
              on:click={startPrimaryAction}
              disabled={igConnecting || finishing}
            >
              {#if role === 'creator'}
                <InstagramLogo size={20} weight="bold" />
              {:else}
                <Briefcase size={20} weight="bold" />
              {/if}
              {#if finishing}
                Building your creator profile...
              {:else if igConnecting}
                Connecting...
              {:else}
                {roleCopy[role].cta}
              {/if}
            </button>
          </div>

          {#if authError}
            <p class="auth-error">{authError}</p>
          {/if}

          <p class="trust-note">{roleCopy[role].trust}</p>
        </div>

        <div class="hero-preview stagger-2">
          <div class="hub-stage" class:brand={role === 'brand'}>
            <div class="signal-line" aria-hidden="true"></div>

            <article class="float-card wallet-card">
              <div class="card-topline">
                <span>{role === 'creator' ? 'Creator wallet' : 'Campaign budget'}</span>
                <Wallet size={18} weight="fill" />
              </div>
              <strong class="big-stat">{role === 'creator' ? '₹8,000' : '₹1.2L'}</strong>
              <p>{role === 'creator' ? 'Accepted brief reward' : 'Active creator allocation'}</p>
              <div class="meter"><span></span></div>
              <div class="split-row">
                <span>{role === 'creator' ? 'Pending' : 'Live briefs'}</span>
                <strong
                  >{role === 'creator' ? 'Post proof received' : 'Creator proof incoming'}</strong
                >
              </div>
            </article>

            <article class="float-card brief-card">
              <div class="brand-mark">{role === 'creator' ? 'CR' : '42'}</div>
              <div>
                <p class="card-kicker">
                  {role === 'creator' ? 'Matched brief' : 'Creator shortlist'}
                </p>
                <h3>{role === 'creator' ? 'CRED-style fintech launch' : '42 creators ready'}</h3>
                <p>
                  {role === 'creator'
                    ? 'High match for creators with finance, city culture, and high-trust storytelling signals.'
                    : 'Filtered by audience fit, content quality, city signal, category affinity, and brand safety.'}
                </p>
                <div class="mini-actions">
                  <span
                    ><CheckCircle size={14} weight="fill" />
                    {role === 'creator' ? 'Approve' : 'Invite'}</span
                  >
                  <span
                    ><ArrowSquareOut size={14} />
                    {role === 'creator' ? 'Submit post URL' : 'Open brief'}</span
                  >
                </div>
              </div>
            </article>

            <article class="float-card portrait-card">
              <div class="portrait-strip" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <p class="card-kicker">
                {role === 'creator' ? 'Signal portrait' : 'Audience intelligence'}
              </p>
              <h3>{role === 'creator' ? 'Not just follower count' : 'Not just creator lists'}</h3>
              <p>
                {role === 'creator'
                  ? 'Aesthetic, audience fit, interests, engagement tier, and momentum.'
                  : 'Taste, audience intent, match reason, projected fit, and campaign readiness.'}
              </p>
            </article>
          </div>
        </div>
      </section>

      <!-- How it works — editorial numbered list, not card grid -->
      <section class="how-section">
        <div class="how-header">
          <span class="section-label">How it works</span>
          <h2 class="section-title">
            {role === 'creator'
              ? 'Three steps to your first paid brief.'
              : 'Three steps to your first campaign.'}
          </h2>
        </div>
        <ol class="steps-list">
          {#if role === 'creator'}
            <li class="step-item">
              <span class="step-ordinal">01</span>
              <div>
                <h3>Connect your Instagram</h3>
                <p>
                  We read your public content, audience, and aesthetic to build your signal
                  portrait. Never your password, never your DMs.
                </p>
              </div>
            </li>
            <li class="step-item">
              <span class="step-ordinal">02</span>
              <div>
                <h3>Get matched to paid briefs</h3>
                <p>
                  Brands post campaigns. Wagwan matches you by culture fit, city, audience signal,
                  and creative style — not follower count.
                </p>
              </div>
            </li>
            <li class="step-item">
              <span class="step-ordinal">03</span>
              <div>
                <h3>Approve, post, get paid</h3>
                <p>
                  You control every brief. Accept it, submit your post as proof, and track your
                  payout in your creator wallet.
                </p>
              </div>
            </li>
          {:else}
            <li class="step-item">
              <span class="step-ordinal">01</span>
              <div>
                <h3>Post a paid brief</h3>
                <p>
                  Define your campaign goal, reward, requirements, and creative direction in a
                  structured brief that creators can act on.
                </p>
              </div>
            </li>
            <li class="step-item">
              <span class="step-ordinal">02</span>
              <div>
                <h3>Discover matched creators</h3>
                <p>
                  Search by audience vibe, culture fit, city, category, and engagement. Every match
                  comes with a reason — not just a number.
                </p>
              </div>
            </li>
            <li class="step-item">
              <span class="step-ordinal">03</span>
              <div>
                <h3>Track and measure</h3>
                <p>
                  Follow approvals, live posts, proof links, and campaign trajectory in one
                  operating layer. No spreadsheets.
                </p>
              </div>
            </li>
          {/if}
        </ol>
      </section>

      <!-- Creator social proof -->
      {#if creators.length > 0}
        <section class="proof-section">
          <span class="section-label">The network</span>
          <h2 class="section-title">Creators already on Wagwan</h2>
          <div class="creator-grid">
            {#each creators as creator, i}
              <div class="creator-card" class:featured={i < 2}>
                <img
                  src={creator.profilePicture}
                  alt={creator.name}
                  class="creator-avatar"
                  loading="lazy"
                />
                <strong class="creator-name">{creator.name}</strong>
                {#if creator.handle}<span class="creator-handle">@{creator.handle}</span>{/if}
                {#if creator.city || creator.archetype}
                  <span class="creator-meta">
                    {creator.city}{creator.city && creator.archetype
                      ? ' · '
                      : ''}{creator.archetype}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Final CTA -->
      <section class="final-cta">
        <h2>{roleCopy[role].title}</h2>
        <button
          type="button"
          class="primary-action"
          class:brand={role === 'brand'}
          on:click={startPrimaryAction}
          disabled={igConnecting || finishing}
        >
          {#if role === 'creator'}
            <InstagramLogo size={20} weight="bold" />
          {:else}
            <Briefcase size={20} weight="bold" />
          {/if}
          {roleCopy[role].cta}
        </button>
      </section>
    </div>
  {/if}

  <!-- Footer -->
  <footer class="wg-footer">
    <img src="/wagwan-logo-white.svg" alt="Wagwan" class="wg-footer-logo" />
    <div class="wg-footer-links">
      <a href="mailto:madhvik@wagwanworld.in" class="wg-footer-link">madhvik@wagwanworld.in</a>
      <span class="wg-footer-sep">·</span>
      <a
        href="https://instagram.com/wagwan.world"
        target="_blank"
        rel="noopener"
        class="wg-footer-link">Instagram</a
      >
      <span class="wg-footer-sep">·</span>
      <a
        href="https://linkedin.com/company/wagwan-world"
        target="_blank"
        rel="noopener"
        class="wg-footer-link">LinkedIn</a
      >
    </div>
  </footer>
</main>

<style>
  /* ── Base ──────────────────────────────────────────────────── */
  .portal-page {
    position: relative;
    min-height: 100svh;
    overflow-x: hidden;
    overflow-y: auto;
    background:
      radial-gradient(circle at 72% 18%, rgba(153, 36, 96, 0.34), transparent 42%),
      radial-gradient(circle at 30% 78%, rgba(196, 242, 74, 0.12), transparent 32%),
      linear-gradient(145deg, #030306 0%, #0b0710 48%, #1b0817 100%);
    color: oklch(96% 0.018 88);
    font-family: var(--font-sans);
  }

  .portal-page,
  .portal-page * {
    box-sizing: border-box;
  }

  /* ── Orbs ──────────────────────────────────────────────────── */
  .orb,
  .grain {
    position: fixed;
    pointer-events: none;
  }

  .orb {
    z-index: 0;
    width: 42vw;
    height: 42vw;
    min-width: 320px;
    min-height: 320px;
    border-radius: 999px;
    filter: blur(60px);
    opacity: 0.44;
    transform: translate3d(0, 0, 0);
    transition:
      opacity 600ms ease,
      transform 600ms ease;
  }

  .orb--lime {
    left: -12vw;
    bottom: -18vw;
    background: rgba(196, 242, 74, 0.22);
    animation: orbDrift1 12s ease-in-out infinite alternate;
  }

  .orb--magenta {
    right: -10vw;
    top: -12vw;
    background: rgba(255, 45, 126, 0.32);
    animation: orbDrift2 14s ease-in-out infinite alternate;
  }

  @keyframes orbDrift1 {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      transform: translate3d(4vw, -3vw, 0) scale(1.08);
    }
    100% {
      transform: translate3d(-2vw, 2vw, 0) scale(0.95);
    }
  }

  @keyframes orbDrift2 {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      transform: translate3d(-5vw, 4vw, 0) scale(1.12);
    }
    100% {
      transform: translate3d(3vw, -2vw, 0) scale(0.92);
    }
  }

  .portal-page.brand-mode .orb--lime {
    opacity: 0.2;
  }

  .portal-page.brand-mode .orb--magenta {
    opacity: 0.6;
    transform: translate3d(0, 0, 0) scale(1.1);
  }

  .portal-page:not(.brand-mode) .orb--lime {
    opacity: 0.6;
    transform: translate3d(0, 0, 0) scale(1.1);
  }

  .grain {
    inset: 0;
    z-index: 1;
    opacity: 0.18;
    mix-blend-mode: soft-light;
    background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 100% 4px;
  }

  /* ── CHOICE SCREEN ─────────────────────────────────────────── */
  .choice-screen {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100svh;
    padding: clamp(24px, 4vw, 48px);
    text-align: center;
    opacity: 0;
    transform: translateY(14px);
    transition:
      opacity 600ms ease,
      transform 600ms ease;
  }

  .choice-screen.ready {
    opacity: 1;
    transform: translateY(0);
  }

  .logo {
    width: clamp(100px, 12vw, 140px);
    height: auto;
    margin-bottom: clamp(20px, 2.5vw, 32px);
  }

  .choice-headline {
    max-width: 720px;
    margin: 0 0 clamp(32px, 5vw, 56px);
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 3.2vw, 2.8rem);
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  /* ── Choice cards ──────────────────────────────────────────── */
  .choice-cards {
    display: flex;
    gap: clamp(16px, 2.5vw, 28px);
    width: min(100%, 680px);
  }

  .choice-card {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: clamp(28px, 4vw, 48px) clamp(20px, 3vw, 32px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    cursor: pointer;
    overflow: hidden;
    transition:
      transform 400ms ease,
      border-color 400ms ease,
      opacity 400ms ease;
    animation: float 4s ease-in-out infinite;
  }

  .choice-card:nth-child(2) {
    animation-delay: -2s;
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }

  .choice-card:hover {
    transform: translateY(-6px);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .choice-card--creator:hover {
    border-color: rgba(196, 242, 74, 0.4);
  }

  .choice-card--brand:hover {
    border-color: rgba(255, 77, 151, 0.4);
  }

  .choice-card:hover ~ .choice-card,
  .choice-card:has(~ .choice-card:hover) {
    opacity: 0.55;
    animation-play-state: paused;
  }

  .card-glow {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    opacity: 0;
    transition: opacity 400ms ease;
    pointer-events: none;
  }

  .card-glow--lime {
    background: radial-gradient(ellipse at 50% 80%, rgba(196, 242, 74, 0.15), transparent 70%);
  }

  .card-glow--magenta {
    background: radial-gradient(ellipse at 50% 80%, rgba(255, 77, 151, 0.15), transparent 70%);
  }

  .choice-card:hover .card-glow {
    opacity: 1;
  }

  .card-label {
    position: relative;
    font-family: var(--font-display);
    font-size: clamp(1.2rem, 2.2vw, 1.6rem);
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .card-teaser {
    position: relative;
    color: rgba(255, 248, 232, 0.58);
    font-size: clamp(0.82rem, 1.1vw, 0.92rem);
    line-height: 1.5;
  }

  /* ── TRANSITION ────────────────────────────────────────────── */
  .transition-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .transition-fill {
    width: 0;
    height: 0;
    border-radius: 999px;
    animation: portalExpand 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .transition-overlay.creator .transition-fill {
    background: radial-gradient(circle, rgba(196, 242, 74, 0.14), rgba(3, 3, 6, 0.92) 60%);
  }

  .transition-overlay.brand .transition-fill {
    background: radial-gradient(circle, rgba(255, 77, 151, 0.14), rgba(3, 3, 6, 0.92) 60%);
  }

  .reduced .transition-fill {
    animation: none;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    opacity: 0;
  }

  @keyframes portalExpand {
    0% {
      width: 0;
      height: 0;
      opacity: 0.8;
    }
    40% {
      width: 180vmax;
      height: 180vmax;
      opacity: 1;
    }
    75% {
      width: 280vmax;
      height: 280vmax;
      opacity: 0.7;
    }
    100% {
      width: 280vmax;
      height: 280vmax;
      opacity: 0;
    }
  }

  /* ── WORLD SCREEN ──────────────────────────────────────────── */
  .world-screen {
    position: relative;
    z-index: 2;
    width: min(100%, 1280px);
    margin: 0 auto;
    padding: clamp(18px, 3vw, 34px) clamp(24px, 4vw, 48px);
  }

  .world-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: clamp(32px, 4vw, 48px);
    opacity: 0;
    transform: translateY(-12px);
    animation: fadeDown 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 50ms;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-logo {
    width: 100px;
    height: auto;
  }

  .role-pill {
    padding: 3px 10px;
    border-radius: 100px;
    background: rgba(196, 242, 74, 0.18);
    color: #c4f24a;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .role-pill.brand {
    background: rgba(255, 77, 151, 0.18);
    color: #ff4d97;
  }

  .switch-link {
    padding: 6px 16px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 100px;
    background: transparent;
    color: rgba(255, 248, 232, 0.6);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      border-color 200ms ease,
      color 200ms ease;
  }

  .switch-link:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 248, 232, 0.9);
  }

  /* ── Hero split: copy left, preview right ──────────────────── */
  .hero-split {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(480px, 1fr);
    gap: clamp(32px, 5vw, 64px);
    align-items: center;
    margin-bottom: clamp(80px, 10vw, 128px);
  }

  .hero-copy {
    text-align: left;
  }

  .hero-preview {
    position: relative;
  }

  .world-title {
    margin: 0 0 20px;
    font-family: var(--font-display);
    font-size: clamp(2rem, 3.6vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.06;
  }

  .world-body {
    margin: 0 0 32px;
    color: rgba(255, 248, 232, 0.65);
    font-size: clamp(0.95rem, 1.2vw, 1.08rem);
    line-height: 1.7;
    max-width: 48ch;
  }

  .world-cta {
    margin-bottom: 12px;
  }

  .primary-action {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 16px 38px;
    border: none;
    border-radius: 14px;
    background: #c4f24a;
    color: #0a0a0a;
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(196, 242, 74, 0.18);
    transition:
      transform 250ms ease,
      box-shadow 350ms ease;
  }

  .primary-action:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 10px 40px rgba(196, 242, 74, 0.35);
  }

  .primary-action:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .primary-action.brand {
    background: #ff4d97;
    color: #fff;
  }

  .primary-action.brand:hover:not(:disabled) {
    box-shadow: 0 8px 32px rgba(255, 77, 151, 0.3);
  }

  .auth-error {
    margin: 12px 0 0;
    color: #ff6b6b;
    font-size: 0.85rem;
  }

  .trust-note {
    margin: 12px 0 0;
    color: rgba(255, 248, 232, 0.42);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  /* ── Hub stage (overlapping card grid) ───────────────────── */
  .hub-stage {
    --mode-primary: #c4f24a;
    --mode-primary-soft: rgba(196, 242, 74, 0.24);
    --mode-card-border: rgba(196, 242, 74, 0.18);
    position: relative;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: repeat(10, minmax(34px, auto));
    gap: 14px;
    min-height: clamp(380px, 42vh, 500px);
  }

  .hub-stage.brand {
    --mode-primary: #ff4d97;
    --mode-primary-soft: rgba(255, 77, 151, 0.24);
    --mode-card-border: rgba(255, 77, 151, 0.22);
  }

  .signal-line {
    position: absolute;
    z-index: 0;
    inset: 30% 6% auto 6%;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--mode-primary),
      rgba(255, 77, 151, 0.44),
      transparent
    );
    transform: rotate(-18deg);
    transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .hub-stage.brand .signal-line {
    transform: rotate(18deg);
  }

  .float-card {
    position: relative;
    z-index: 1;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 28px;
    padding: clamp(18px, 2vw, 22px);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.045)),
      rgba(20, 18, 23, 0.72);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 28px 80px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(28px);
    transition:
      transform 280ms cubic-bezier(0.16, 1, 0.3, 1),
      border-color 280ms ease;
  }

  .hub-stage.brand .float-card {
    border-color: var(--mode-card-border);
  }

  .wallet-card {
    grid-column: 4 / 13;
    grid-row: 1 / 5;
    align-self: start;
    z-index: 3;
  }

  .brief-card {
    grid-column: 1 / 7;
    grid-row: 5 / 10;
    z-index: 2;
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 14px;
  }

  .portrait-card {
    grid-column: 7 / 13;
    grid-row: 6 / 11;
    align-self: end;
    z-index: 2;
  }

  .hub-stage.brand .wallet-card {
    transform: translate(-10px, 8px);
  }

  .hub-stage.brand .brief-card {
    transform: translate(8px, -6px);
  }

  .hub-stage.brand .portrait-card {
    transform: translate(-8px, -8px);
  }

  .card-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    color: #9cec7b;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .big-stat {
    display: block;
    margin: 14px 0 4px;
    font-family: var(--font-display);
    font-size: clamp(2.4rem, 4vw, 3.35rem);
    font-weight: 600;
    letter-spacing: -0.08em;
    line-height: 0.9;
    color: var(--mode-primary);
  }

  .float-card p {
    margin: 0;
    color: rgba(255, 248, 232, 0.72);
    font-size: 0.82rem;
    line-height: 1.55;
  }

  .float-card h3 {
    margin: 0 0 6px;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .meter {
    height: 10px;
    margin: 22px 0 14px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .meter span {
    display: block;
    width: 72%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #65ec7a, #c4f24a 58%, #ffbe1b);
  }

  .hub-stage.brand .meter span {
    background: linear-gradient(90deg, #ff4d97, #ff7eb3 58%, #ffbe1b);
  }

  .split-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255, 248, 232, 0.55);
    font-size: 0.75rem;
  }

  .split-row strong {
    color: rgba(255, 248, 232, 0.8);
  }

  .brand-mark {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 58px;
    border-radius: 16px;
    background: rgba(196, 242, 74, 0.14);
    color: #c4f24a;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .hub-stage.brand .brand-mark {
    background: rgba(255, 77, 151, 0.14);
    color: #ff4d97;
  }

  .card-kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 6px;
    color: #9cec7b;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .hub-stage.brand .card-kicker {
    color: #ff7eb3;
  }

  .mini-actions {
    display: flex;
    gap: 14px;
    margin-top: 10px;
    color: var(--mode-primary);
    font-size: 0.76rem;
    font-weight: 700;
  }

  .mini-actions span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .portrait-strip {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .portrait-strip span {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(196, 242, 74, 0.12);
  }

  .hub-stage.brand .portrait-strip span {
    background: rgba(255, 77, 151, 0.12);
  }

  .portrait-strip span:nth-child(2) {
    opacity: 0.7;
  }
  .portrait-strip span:nth-child(3) {
    opacity: 0.5;
  }
  .portrait-strip span:nth-child(4) {
    opacity: 0.3;
  }

  /* ── Stagger animations ────────────────────────────────────── */
  @keyframes fadeDown {
    from {
      opacity: 0;
      transform: translateY(-12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(18px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .stagger-1,
  .stagger-2,
  .stagger-3,
  .stagger-4,
  .stagger-5,
  .stagger-6,
  .stagger-7 {
    opacity: 0;
    animation: fadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .stagger-1 {
    animation-delay: 150ms;
  }
  .stagger-2 {
    animation-delay: 300ms;
  }
  .stagger-3 {
    animation-delay: 450ms;
  }
  .stagger-4 {
    animation-delay: 580ms;
  }
  .stagger-5 {
    animation-delay: 720ms;
  }
  .stagger-6 {
    animation-delay: 860ms;
  }
  .stagger-7 {
    animation-delay: 1000ms;
  }

  .reduced .stagger-1,
  .reduced .stagger-2,
  .reduced .stagger-3,
  .reduced .stagger-4,
  .reduced .stagger-5,
  .reduced .stagger-6,
  .reduced .stagger-7 {
    animation: none;
    opacity: 1;
  }

  .reduced .world-nav {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .reduced .orb--lime,
  .reduced .orb--magenta {
    animation: none;
  }

  /* ── Shared section labels ───────────────────────────────── */
  .section-label {
    display: block;
    margin-bottom: 12px;
    color: rgba(255, 248, 232, 0.4);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .section-title {
    margin: 0 0 16px;
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 2.8vw, 2.2rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.1;
    max-width: 22ch;
  }

  /* ── How it works — editorial numbered list ─────────────── */
  .how-section {
    display: grid;
    grid-template-columns: minmax(0, 0.4fr) minmax(0, 0.6fr);
    gap: clamp(32px, 5vw, 64px);
    align-items: start;
    margin-bottom: clamp(80px, 10vw, 128px);
  }

  .how-header {
    position: sticky;
    top: 32px;
  }

  .steps-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .step-item {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 16px;
    padding: clamp(20px, 2.5vw, 28px) 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .step-item:first-child {
    padding-top: 0;
  }

  .step-item:last-child {
    border-bottom: none;
  }

  .step-ordinal {
    color: var(--mode-primary, #c4f24a);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding-top: 2px;
  }

  .world-screen.brand .step-ordinal {
    color: #ff4d97;
  }

  .step-item h3 {
    margin: 0 0 8px;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .step-item p {
    margin: 0;
    color: rgba(255, 248, 232, 0.58);
    font-size: 0.88rem;
    line-height: 1.6;
    max-width: 52ch;
  }

  /* ── Creator social proof ──────────────────────────────────── */
  .proof-section {
    margin-bottom: clamp(80px, 10vw, 128px);
  }

  .creator-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin-top: 32px;
  }

  .creator-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    text-align: center;
    transition:
      border-color 300ms ease,
      transform 300ms ease;
  }

  .creator-card:hover {
    border-color: rgba(196, 242, 74, 0.2);
    transform: translateY(-3px);
  }

  .world-screen.brand .creator-card:hover {
    border-color: rgba(255, 77, 151, 0.2);
  }

  .creator-card.featured {
    grid-row: span 1;
  }

  .creator-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .creator-name {
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .creator-handle {
    color: rgba(255, 248, 232, 0.4);
    font-size: 0.72rem;
  }

  .creator-meta {
    color: rgba(255, 248, 232, 0.32);
    font-size: 0.68rem;
    line-height: 1.3;
  }

  /* ── Final CTA ─────────────────────────────────────────────── */
  .final-cta {
    text-align: center;
    max-width: 620px;
    margin: 0 auto;
    padding: clamp(32px, 5vw, 56px) 0 clamp(60px, 8vw, 100px);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .final-cta h2 {
    margin: 0 0 24px;
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.08;
  }

  /* ── Footer ─────────────────────────────────────────────────── */
  .wg-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 24px 48px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: 48px;
    position: relative;
    z-index: 2;
  }

  .wg-footer-logo {
    height: 16px;
    width: auto;
    opacity: 0.25;
  }

  .wg-footer-links {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .wg-footer-link {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 248, 232, 0.3);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .wg-footer-link:hover {
    color: #c4f24a;
  }

  .wg-footer-sep {
    color: rgba(255, 248, 232, 0.15);
    font-size: 10px;
  }

  /* ── Tablet ─────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .hero-split {
      grid-template-columns: 1fr;
      gap: clamp(32px, 5vw, 48px);
    }

    .hero-copy {
      text-align: center;
      max-width: 560px;
      margin: 0 auto;
    }

    .world-body {
      margin-left: auto;
      margin-right: auto;
    }

    .world-cta {
      display: flex;
      justify-content: center;
    }

    .hero-preview {
      max-width: 560px;
      margin: 0 auto;
    }

    .how-section {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .how-header {
      position: static;
    }

    .section-title {
      max-width: none;
    }
  }

  /* ── Mobile ────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .choice-cards {
      flex-direction: column;
    }

    .choice-card:hover ~ .choice-card,
    .choice-card:has(~ .choice-card:hover) {
      opacity: 1;
    }

    .hub-stage {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: auto;
    }

    .hub-stage .signal-line {
      display: none;
    }

    .hub-stage.brand .wallet-card,
    .hub-stage.brand .brief-card,
    .hub-stage.brand .portrait-card {
      transform: none;
    }

    .brief-card {
      grid-template-columns: 48px 1fr;
    }

    .creator-grid {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .step-item {
      grid-template-columns: 36px 1fr;
      gap: 12px;
    }
  }
</style>
