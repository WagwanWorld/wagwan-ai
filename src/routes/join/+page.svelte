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
  import Scales from 'phosphor-svelte/lib/Scales';
  import TrendUp from 'phosphor-svelte/lib/TrendUp';
  import Wallet from 'phosphor-svelte/lib/Wallet';

  type Role = 'creator' | 'brand';
  type ValueCard = {
    kicker: string;
    title: string;
    body: string;
    stat?: string;
    meta?: string;
    chips?: string[];
    wide?: boolean;
  };

  let role: Role = 'creator';
  let visible = false;
  let reducedMotion = false;
  let roleChosen = false;
  let igConnecting = false;
  let finishing = false;
  let authError = '';
  let igIdentity: InstagramIdentity | null = null;
  let igToken = '';

  const roleCopy: Record<
    Role,
    {
      eyebrow: string;
      label: string;
      title: string;
      body: string;
      cta: string;
      trust: string;
    }
  > = {
    creator: {
      eyebrow: 'You are a creator',
      label: 'Creator mode',
      title: 'Get discovered by brands that match your signal.',
      body: 'Connect Instagram once. Wagwan turns public content, audience fit, city, aesthetic, and momentum into a creator profile brands can actually buy from.',
      cta: 'Connect creator Instagram',
      trust: 'Public profile and insights only. Never your password. Never your DMs.',
    },
    brand: {
      eyebrow: 'You are a brand',
      label: 'Brand mode',
      title: 'Find creators by culture fit, not follower count.',
      body: 'Enter the brand portal to build briefs, discover creators, track approvals, collect proof, and turn campaign performance into a live operating system.',
      cta: 'Connect brand Instagram',
      trust: 'Brand sign-in uses a separate Instagram session for your brand account.',
    },
  };

  const creatorCards: ValueCard[] = [
    {
      kicker: 'Creator wallet',
      title: 'Paid brief wallet',
      body: 'See accepted rewards, pending balance, proof received, and available payout status in one place.',
      stat: '₹8,000',
      meta: 'Accepted brief reward',
      chips: ['Pending', 'Proof received', 'Wallet visible'],
      wide: true,
    },
    {
      kicker: 'Matched brief',
      title: 'Brand deals that explain why',
      body: 'Every brief shows the brand, reward, campaign angle, and the exact audience signal that made you a match.',
      stat: '92%',
      meta: 'Culture fit',
      chips: ['Approve', 'Decline', 'Submit URL'],
    },
    {
      kicker: 'Signal portrait',
      title: 'Not just follower count',
      body: 'Aesthetic, audience fit, interests, city, engagement tier, and momentum become your creator identity.',
      chips: ['Aesthetic', 'City signal', 'Momentum'],
    },
    {
      kicker: 'Creator control',
      title: 'You approve every brief',
      body: 'Brands can request you. They cannot post for you. Nothing moves until you accept the brief.',
      chips: ['Consent first', 'No forced posts'],
    },
    {
      kicker: 'Growth loop',
      title: 'Proof builds future demand',
      body: 'Completed briefs improve your credibility, sharpen matching, and help better brands discover you next.',
      chips: ['Proof URL', 'Receipts', 'More matches'],
    },
  ];

  const brandCards: ValueCard[] = [
    {
      kicker: 'Creator discovery',
      title: 'Find any creator by signal',
      body: 'Search across audience vibe, culture fit, city, category, engagement, and creative style instead of chasing DMs.',
      stat: '1 hub',
      meta: 'Creator distribution layer',
      chips: ['Audience fit', 'City', 'Category'],
      wide: true,
    },
    {
      kicker: 'Brief builder',
      title: 'Turn goals into paid briefs',
      body: 'Structure campaign goals, rewards, requirements, approval states, and creator instructions before anything goes live.',
      stat: '₹',
      meta: 'Reward upfront',
      chips: ['Goal', 'Reward', 'Requirements'],
    },
    {
      kicker: 'Audience intelligence',
      title: 'Know why a creator matches',
      body: 'Compare creators by audience intent, affinity, content direction, and expected fit rather than vanity metrics.',
      chips: ['Match reason', 'Affinity', 'Intent'],
    },
    {
      kicker: 'Ops pipeline',
      title: 'Track every state',
      body: 'Follow sent, accepted, live, proof received, completed, and declined states without spreadsheet drift.',
      chips: ['Sent', 'Accepted', 'Completed'],
    },
    {
      kicker: 'Prediction layer',
      title: 'Plan with receipts',
      body: 'Use campaign trajectory, content direction, and proof links to understand what worked and what to do next.',
      chips: ['Trajectory', 'Proof', 'Insight'],
    },
  ];

  const activeCopy = () => roleCopy[role];
  const activeCards = () => (role === 'creator' ? creatorCards : brandCards);

  function setRole(nextRole: Role) {
    role = nextRole;
    roleChosen = true;
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
    }

    if (params.get('ig_connected') === '1') {
      role = 'creator';
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
  <title>Join Wagwan | Brands and Creators</title>
  <meta
    name="description"
    content="Join Wagwan as a creator or brand. Discover paid briefs, creator matches, campaign operations, and marketplace intelligence in one distribution hub."
  />
</svelte:head>

<main
  class="join-page"
  class:ready={visible}
  class:brand-mode={roleChosen && role === 'brand'}
  data-app-chrome="dark"
>
  <div class="join-orb join-orb--lime" aria-hidden="true"></div>
  <div class="join-orb join-orb--magenta" aria-hidden="true"></div>
  <div class="join-grain" aria-hidden="true"></div>

  <div class="join-shell">
    <nav class="join-nav" aria-label="Join navigation">
      <div class="brand-lockup">
        <img src="/wagwan-logo-white.svg" alt="Wagwan" />
        <span>Distribution hub</span>
      </div>
    </nav>

    <section class="hero-grid" class:intro-gate={!roleChosen} aria-labelledby="join-title">
      <div class="hero-copy">
        <p class="eyebrow">
          <Lightning size={14} weight="fill" />
          Wagwan distribution hub
        </p>
        <h1 id="join-title">Every creator gets discovered. Every brand finds culture fit.</h1>
        <p class="hero-sub">
          A live marketplace where audience signal, creative taste, briefs, approvals, proof,
          payouts, and insights move through one operating layer.
        </p>

        <div class="role-choice" class:chosen={roleChosen}>
          <p class="choice-label">Choose your path</p>
          <h2 class="choice-title">Are you a creator or a brand?</h2>
          <div
            class="role-switch"
            class:unchosen={!roleChosen}
            role="tablist"
            aria-label="Choose your Wagwan role"
          >
            <span class="switch-indicator" class:brand={role === 'brand'} aria-hidden="true"></span>
            <button
              type="button"
              role="tab"
              aria-selected={roleChosen && role === 'creator'}
              class:active={roleChosen && role === 'creator'}
              on:click={() => setRole('creator')}
            >
              I am a Creator
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleChosen && role === 'brand'}
              class:active={roleChosen && role === 'brand'}
              on:click={() => setRole('brand')}
            >
              I am a Brand
            </button>
          </div>
        </div>

        {#if roleChosen}
          <div class="role-panel revealed" class:brand={role === 'brand'}>
            <p class="role-label">{activeCopy().eyebrow}</p>
            <h2>{activeCopy().title}</h2>
            <p>{activeCopy().body}</p>

            <div class="hero-actions">
              <button
                type="button"
                class="primary-action"
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
                  {activeCopy().cta}
                {/if}
              </button>
            </div>

            {#if authError}
              <p class="auth-error">{authError}</p>
            {/if}

            <p class="trust-note">{activeCopy().trust}</p>
          </div>
        {/if}
      </div>

      <div
        class="hub-stage"
        class:revealed={roleChosen}
        class:brand={role === 'brand'}
        aria-label={`${activeCopy().label} preview`}
      >
        <div class="signal-line" aria-hidden="true"></div>
        <article class="float-card wallet-card">
          <div class="card-topline">
            <span>{role === 'creator' ? 'Creator wallet' : 'Campaign budget'}</span>
            <Wallet size={18} weight="fill" />
          </div>
          <strong class="big-stat">{role === 'creator' ? '₹8,000' : '₹1.2L'}</strong>
          <p>{role === 'creator' ? 'Accepted brief reward' : 'Active creator allocation'}</p>
          <div class="meter">
            <span></span>
          </div>
          <div class="split-row">
            <span>{role === 'creator' ? 'Pending' : 'Live briefs'}</span>
            <strong>{role === 'creator' ? 'Post proof received' : 'Creator proof incoming'}</strong>
          </div>
        </article>

        <article class="float-card brief-card">
          <div class="brand-mark">{role === 'creator' ? 'CR' : '42'}</div>
          <div>
            <p class="card-kicker">{role === 'creator' ? 'Matched brief' : 'Creator shortlist'}</p>
            <h2>{role === 'creator' ? 'CRED-style fintech launch' : '42 creators ready'}</h2>
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
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p class="card-kicker">
            {role === 'creator' ? 'Signal portrait' : 'Audience intelligence'}
          </p>
          <h2>{role === 'creator' ? 'Not just follower count' : 'Not just creator lists'}</h2>
          <p>
            {role === 'creator'
              ? 'Aesthetic, audience fit, interests, engagement tier, and momentum.'
              : 'Taste, audience intent, match reason, projected fit, and campaign readiness.'}
          </p>
        </article>
      </div>
    </section>

    {#if roleChosen}
      <section class="value-section reveal-section" aria-labelledby="value-title">
        <div class="section-heading">
          <p class="eyebrow">{role === 'creator' ? 'What creators get' : 'What brands get'}</p>
          <h2 id="value-title">
            {role === 'creator'
              ? 'Real paid opportunities with control, context, and receipts.'
              : 'A creator distribution layer with search, ops, and proof built in.'}
          </h2>
        </div>

        <div class="value-grid" class:brand={role === 'brand'}>
          {#each activeCards() as card}
            <article class="value-card" class:wide={card.wide}>
              <p class="card-kicker">{card.kicker}</p>
              {#if card.stat}
                <strong class="value-stat">{card.stat}</strong>
                <span class="value-meta">{card.meta}</span>
              {/if}
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {#if card.chips}
                <div class="chip-row">
                  {#each card.chips as chip}
                    <span>{chip}</span>
                  {/each}
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </section>

      <section class="bridge-section reveal-section" aria-labelledby="bridge-title">
        <div>
          <p class="eyebrow">How the hub distributes opportunity</p>
          <h2 id="bridge-title">One marketplace loop, two clean entry points.</h2>
        </div>
        <div class="bridge-steps">
          <article>
            <Briefcase size={20} weight="fill" />
            <span>01</span>
            <h3>Brand brief</h3>
            <p>
              Campaign goal, reward, requirements, and creative direction become structured demand.
            </p>
          </article>
          <article>
            <MagnetStraight size={20} weight="fill" />
            <span>02</span>
            <h3>Creator match</h3>
            <p>Audience signal, location, aesthetic, category, and momentum decide who fits.</p>
          </article>
          <article>
            <Scales size={20} weight="fill" />
            <span>03</span>
            <h3>Approval layer</h3>
            <p>Creators accept or decline. Brands see state, status, and next action.</p>
          </article>
          <article>
            <PaperPlaneTilt size={20} weight="fill" />
            <span>04</span>
            <h3>Proof and payout</h3>
            <p>Live proof closes the loop for creator wallet status and brand campaign insight.</p>
          </article>
        </div>
      </section>

      <section class="final-cta reveal-section" aria-label="Join Wagwan">
        <p class="eyebrow">{activeCopy().label}</p>
        <h2>{activeCopy().title}</h2>
        <button
          type="button"
          class="primary-action"
          on:click={startPrimaryAction}
          disabled={igConnecting || finishing}
        >
          <TrendUp size={20} weight="bold" />
          {activeCopy().cta}
        </button>
      </section>
    {/if}
  </div>
</main>

<style>
  .join-page {
    position: relative;
    height: 100svh;
    overflow-y: auto;
    overflow-x: hidden;
    --mode-primary: #c4f24a;
    --mode-primary-soft: rgba(196, 242, 74, 0.24);
    --mode-border: rgba(196, 242, 74, 0.28);
    --mode-card-border: rgba(196, 242, 74, 0.18);
    background:
      radial-gradient(circle at 72% 18%, rgba(153, 36, 96, 0.34), transparent 42%),
      radial-gradient(circle at 30% 78%, rgba(196, 242, 74, 0.12), transparent 32%),
      linear-gradient(145deg, #030306 0%, #0b0710 48%, #1b0817 100%);
    color: oklch(96% 0.018 88);
    font-family: var(--font-sans);
  }

  .join-page.brand-mode {
    --mode-primary: #ff4d97;
    --mode-primary-soft: rgba(255, 77, 151, 0.24);
    --mode-border: rgba(255, 77, 151, 0.3);
    --mode-card-border: rgba(255, 77, 151, 0.22);
  }

  .join-page,
  .join-page * {
    box-sizing: border-box;
  }

  .join-orb,
  .join-grain {
    position: fixed;
    pointer-events: none;
  }

  .join-orb {
    z-index: 0;
    width: 42vw;
    height: 42vw;
    min-width: 320px;
    min-height: 320px;
    border-radius: 999px;
    filter: blur(60px);
    opacity: 0.44;
    transform: translate3d(0, 0, 0);
  }

  .join-orb--lime {
    left: -12vw;
    bottom: -18vw;
    background: rgba(196, 242, 74, 0.22);
  }

  .join-orb--magenta {
    right: -10vw;
    top: -12vw;
    background: rgba(255, 45, 126, 0.32);
  }

  .join-page.brand-mode .join-orb--lime {
    opacity: 0.28;
  }

  .join-page.brand-mode .join-orb--magenta {
    opacity: 0.58;
    background: rgba(255, 45, 126, 0.42);
  }

  .join-grain {
    inset: 0;
    z-index: 1;
    opacity: 0.18;
    mix-blend-mode: soft-light;
    background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 100% 4px;
  }

  .join-shell {
    position: relative;
    z-index: 2;
    width: min(100%, 1240px);
    margin: 0 auto;
    padding: clamp(18px, 3.2vw, 34px);
  }

  .join-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: clamp(24px, 4vw, 46px);
  }

  .brand-lockup,
  .hero-actions,
  .card-topline,
  .mini-actions,
  .split-row,
  .chip-row {
    display: flex;
    align-items: center;
  }

  .brand-lockup {
    gap: 12px;
    color: inherit;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .brand-lockup img {
    width: 122px;
    height: auto;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(560px, 0.95fr);
    gap: clamp(28px, 4.5vw, 58px);
    align-items: center;
  }

  .hero-grid.intro-gate {
    min-height: calc(100svh - clamp(140px, 18vw, 210px));
    grid-template-columns: minmax(0, 1fr);
    place-items: center;
    text-align: center;
  }

  .hero-grid.intro-gate .hero-copy {
    width: min(100%, 680px);
    display: grid;
    justify-items: center;
  }

  .hero-grid.intro-gate h1 {
    max-width: 14.5ch;
  }

  .hero-grid.intro-gate .hero-sub {
    margin-right: auto;
    margin-left: auto;
  }

  .hero-grid.intro-gate .role-choice {
    margin-right: auto;
    margin-left: auto;
  }

  .hero-grid.intro-gate .hub-stage {
    display: none;
  }

  .hero-copy {
    opacity: 0;
    transform: translateY(18px);
    transition:
      opacity 700ms var(--ease-premium),
      transform 700ms var(--ease-premium);
  }

  .ready .hero-copy {
    opacity: 1;
    transform: translateY(0);
  }

  .eyebrow,
  .card-kicker,
  .role-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: #9cec7b;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3,
  p {
    margin-top: 0;
  }

  h1 {
    max-width: 15ch;
    margin-bottom: 16px;
    font-family: var(--font-display);
    font-size: clamp(2.45rem, 4.8vw, 4.25rem);
    font-weight: 600;
    letter-spacing: -0.068em;
    line-height: 0.96;
  }

  .hero-sub {
    max-width: 54ch;
    margin-bottom: 20px;
    color: rgba(255, 248, 232, 0.72);
    font-size: clamp(0.95rem, 1.3vw, 1.08rem);
    line-height: 1.6;
  }

  .role-choice {
    display: grid;
    gap: 12px;
    width: min(100%, 560px);
    margin-top: 26px;
    margin-bottom: 0;
  }

  .role-choice.chosen {
    width: min(100%, 430px);
  }

  .choice-label {
    margin: 0;
    color: rgba(255, 248, 232, 0.62);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .choice-title {
    margin: 0;
    font-size: clamp(1.25rem, 2vw, 1.8rem);
    letter-spacing: -0.055em;
    line-height: 1.05;
  }

  .role-switch {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    min-height: 58px;
    padding: 5px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(18px);
  }

  .switch-indicator {
    position: absolute;
    inset: 5px auto 5px 5px;
    width: calc(50% - 5px);
    border-radius: 999px;
    background: var(--mode-primary);
    box-shadow: 0 12px 36px var(--mode-primary-soft);
    transition: transform 260ms var(--ease-premium);
  }

  .role-switch.unchosen .switch-indicator {
    opacity: 0;
  }

  .switch-indicator.brand {
    transform: translateX(100%);
  }

  .role-switch button {
    position: relative;
    z-index: 1;
    min-height: 44px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 248, 232, 0.76);
    cursor: pointer;
    font: inherit;
    font-size: clamp(0.95rem, 1.2vw, 1.08rem);
    font-weight: 900;
    transition: color 200ms var(--ease-premium);
  }

  .role-switch button.active {
    color: #10120a;
  }

  .role-panel {
    max-width: 560px;
    padding: 18px 0 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-width: 1px 0 0;
    border-radius: 0;
    background: transparent;
    transition:
      border-color 260ms var(--ease-premium),
      transform 260ms var(--ease-premium),
      opacity 260ms var(--ease-premium);
  }

  .role-panel.revealed,
  .reveal-section {
    animation: revealUp 360ms var(--ease-premium) both;
  }

  .role-panel.brand {
    border-color: rgba(255, 77, 151, 0.24);
  }

  .role-panel h2 {
    margin: 10px 0 8px;
    font-size: clamp(1.25rem, 1.8vw, 1.65rem);
    letter-spacing: -0.05em;
    line-height: 1.08;
  }

  .role-panel p {
    color: rgba(255, 248, 232, 0.72);
    line-height: 1.55;
  }

  .hero-actions {
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 20px;
  }

  .primary-action {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 0;
    border-radius: 999px;
    padding: 0 22px;
    background: var(--mode-primary);
    color: #10120a;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
    box-shadow: 0 16px 36px var(--mode-primary-soft);
    transition:
      transform 220ms var(--ease-premium),
      box-shadow 220ms var(--ease-premium),
      background 220ms var(--ease-premium);
  }

  .primary-action:hover {
    transform: translateY(-2px);
    background: var(--mode-primary);
    box-shadow: 0 20px 44px var(--mode-primary-soft);
  }

  .primary-action:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  .trust-note,
  .auth-error {
    margin: 14px 0 0;
    font-size: 0.9rem;
  }

  .auth-error {
    color: #ff8d9d !important;
  }

  .hub-stage {
    position: relative;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: repeat(10, minmax(38px, auto));
    gap: 16px;
    min-height: clamp(540px, 58vh, 620px);
    max-width: 700px;
    opacity: 0;
    visibility: hidden;
    transform: translateX(18px) scale(0.98);
    transition:
      opacity 420ms var(--ease-premium),
      visibility 420ms var(--ease-premium),
      transform 420ms var(--ease-premium);
  }

  .ready .hub-stage.revealed {
    opacity: 1;
    visibility: visible;
    transform: translateX(0) scale(1);
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
    transition: transform 280ms var(--ease-premium);
  }

  .hub-stage.brand .signal-line {
    transform: rotate(18deg);
  }

  .float-card,
  .value-card,
  .bridge-steps article,
  .final-cta {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.045)),
      rgba(20, 18, 23, 0.72);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 28px 80px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(28px);
  }

  .float-card {
    position: relative;
    z-index: 1;
    border-radius: 28px;
    padding: clamp(18px, 2vw, 22px);
    transition:
      transform 280ms var(--ease-premium),
      border-color 280ms var(--ease-premium),
      background 280ms var(--ease-premium);
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
    justify-content: space-between;
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
    letter-spacing: -0.08em;
    line-height: 0.9;
  }

  .float-card p,
  .value-card p,
  .bridge-steps p {
    margin-bottom: 0;
    color: rgba(255, 248, 232, 0.72);
    line-height: 1.55;
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

  .split-row {
    justify-content: space-between;
    gap: 12px;
    font-weight: 800;
  }

  .brand-mark {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    border-radius: 20px;
    background: linear-gradient(135deg, #ff5c6c, #ff2d95);
    color: white;
    font-weight: 950;
  }

  .brief-card h2,
  .portrait-card h2 {
    margin: 8px 0;
    font-size: clamp(1.08rem, 1.45vw, 1.3rem);
    letter-spacing: -0.055em;
    line-height: 1.08;
  }

  .mini-actions,
  .chip-row {
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }

  .mini-actions span,
  .chip-row span {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 0 11px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 248, 232, 0.86);
    font-size: 0.78rem;
    font-weight: 800;
  }

  .portrait-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }

  .portrait-strip span {
    aspect-ratio: 1;
    border-radius: 16px;
    background:
      radial-gradient(circle at 26% 24%, #ffe6a7, transparent 38%),
      linear-gradient(135deg, #ff72a6, #65d47c 72%);
  }

  @keyframes revealUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .value-section,
  .bridge-section,
  .final-cta {
    margin-top: clamp(60px, 8vw, 104px);
  }

  .section-heading {
    display: grid;
    grid-template-columns: minmax(0, 0.55fr) minmax(0, 1fr);
    gap: 28px;
    align-items: end;
    margin-bottom: 28px;
  }

  .section-heading h2,
  .bridge-section h2,
  .final-cta h2 {
    margin-bottom: 0;
    font-size: clamp(1.7rem, 3vw, 2.8rem);
    letter-spacing: -0.065em;
    line-height: 1.02;
  }

  .value-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }

  .value-card {
    min-height: 230px;
    border-radius: 30px;
    padding: clamp(20px, 2.4vw, 28px);
    transition:
      transform 220ms var(--ease-premium),
      border-color 220ms var(--ease-premium);
  }

  .value-card:hover {
    transform: translateY(-4px);
    border-color: rgba(196, 242, 74, 0.28);
  }

  .value-grid.brand .value-card:hover {
    border-color: rgba(255, 77, 151, 0.28);
  }

  .value-stat {
    display: block;
    margin: 16px 0 4px;
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 3.6vw, 3.5rem);
    letter-spacing: -0.08em;
    line-height: 0.88;
  }

  .value-meta {
    display: block;
    margin-bottom: 26px;
    color: rgba(255, 248, 232, 0.6);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .value-card h3 {
    margin-bottom: 10px;
    font-size: clamp(1.28rem, 2vw, 1.75rem);
    letter-spacing: -0.055em;
    line-height: 1;
  }

  @media (min-width: 1024px) {
    .value-grid {
      grid-template-columns: repeat(12, 1fr);
    }

    .value-card {
      grid-column: span 3;
    }

    .value-card.wide {
      grid-column: span 6;
    }

    .value-card:nth-child(4),
    .value-card:nth-child(5) {
      grid-column: span 6;
      min-height: 220px;
    }
  }

  .bridge-section {
    display: grid;
    grid-template-columns: minmax(0, 0.42fr) minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }

  .bridge-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 14px;
  }

  .bridge-steps article {
    min-height: 230px;
    border-radius: 26px;
    padding: 22px;
  }

  .bridge-steps article > span {
    display: block;
    margin: 28px 0 10px;
    color: #9cec7b;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 900;
  }

  .bridge-steps h3 {
    margin-bottom: 10px;
    font-size: 1.25rem;
    letter-spacing: -0.04em;
  }

  .final-cta {
    display: grid;
    gap: 20px;
    justify-items: start;
    margin-bottom: 48px;
    border-radius: 34px;
    padding: clamp(28px, 5vw, 56px);
  }

  .final-cta h2 {
    max-width: 780px;
  }

  @media (max-width: 1023px) {
    .hero-grid,
    .bridge-section {
      grid-template-columns: 1fr;
    }

    .hero-grid.intro-gate {
      min-height: calc(100svh - 150px);
    }

    .hub-stage {
      width: min(100%, 700px);
      min-height: 540px;
      margin: 0 auto;
    }

    .value-card,
    .value-card.wide {
      grid-column: auto;
    }

    h1 {
      max-width: 12ch;
    }
  }

  @media (max-width: 767px) {
    .join-page {
      height: 100svh;
    }

    .join-shell {
      padding: 18px 14px 28px;
    }

    .join-nav {
      margin-bottom: 34px;
    }

    .brand-lockup {
      gap: 8px;
    }

    .brand-lockup img {
      width: 104px;
    }

    h1 {
      max-width: 12.5ch;
      font-size: clamp(2.55rem, 12vw, 3.65rem);
      line-height: 0.98;
    }

    .role-switch {
      width: 100%;
    }

    .role-panel {
      padding: 18px;
      border-radius: 24px;
    }

    .hero-actions,
    .primary-action {
      width: 100%;
    }

    .hub-stage {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: auto;
      gap: 14px;
      min-height: 0;
    }

    .signal-line {
      display: none;
    }

    .float-card,
    .wallet-card,
    .brief-card,
    .portrait-card {
      position: relative;
      inset: auto;
      width: 100%;
      grid-column: auto;
      grid-row: auto;
      transform: none !important;
    }

    .brief-card {
      grid-template-columns: 64px 1fr;
    }

    .brand-mark {
      width: 58px;
      height: 58px;
      border-radius: 18px;
    }

    .big-stat {
      font-size: clamp(2.45rem, 12vw, 3.35rem);
    }

    .section-heading {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .value-grid {
      grid-template-columns: 1fr;
    }

    .value-card,
    .value-card.wide {
      grid-column: auto;
      min-height: 0;
    }

    .bridge-steps {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 420px) {
    .join-nav {
      justify-content: center;
    }

    .brief-card {
      grid-template-columns: 1fr;
    }

    .brand-mark {
      width: 58px;
      height: 58px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .join-page *,
    .join-page *::before,
    .join-page *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
