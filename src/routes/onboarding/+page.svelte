<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import type { InstagramIdentity } from '$lib/server/instagram';
  import type { GoogleIdentity, SpotifyIdentity, LinkedInIdentity, AppleMusicIdentity } from '$lib/utils';
  import { normalizeAppleMusicIdentity } from '$lib/utils';
  import ProductPreviewCard from '$lib/components/onboarding/ProductPreviewCard.svelte';
  import { primaryAccountKeyFromOAuthState } from '$lib/auth/accountKey';
  import { fetchCloudProfile } from '$lib/auth/profileRemote';

  let step = 1;

  // ── Google ──
  let googleConnected = false;
  let googleIdentity: GoogleIdentity | null = null;
  let googleTokens: { accessToken: string; refreshToken: string } | null = null;
  let googleConnecting = false;
  let googleError = '';

  // ── Instagram ──
  let igConnected = false;
  let igIdentity: InstagramIdentity | null = null;
  let igConnecting = false;
  let igError = '';

  // ── Optional signals ──
  let spotifyConnected = false;
  let spotifyIdentity: SpotifyIdentity | null = null;
  let linkedinConnected = false;
  let linkedinIdentity: LinkedInIdentity | null = null;
  let linkedinError = '';

  // ── Apple Music (optional, step 3) ──
  let appleMusicConnected = false;
  let appleMusicIdentity: AppleMusicIdentity | null = null;

  // ── Platform tokens (for Supabase persistence) ──
  let igToken = '';
  let spotifyToken = '';
  let linkedinToken = '';

  let cloudExtras: Partial<UserProfile> = {};
  let finishError = '';

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

  // ── Preferences ──
  let budget: 'low' | 'mid' | 'high' = 'mid';
  let manualCity = '';

  // ── Derived ──
  $: displayName = googleIdentity?.name?.split(' ')[0] || igIdentity?.displayName?.split(' ')[0] || '';
  $: displayPicture = googleIdentity?.picture || igIdentity?.profilePicture || '';
  $: autoCity = igIdentity?.city || manualCity || '';
  $: personalTags = igIdentity?.interests?.slice(0, 6) ?? [];

  // ── Gradient animation ──
  let g1: HTMLDivElement, g2: HTMLDivElement, g3: HTMLDivElement;
  let fieldReady = false;
  let raf: number;

  function startGradient() {
    let prev = 0;
    function tick(ts: number) {
      const dt = prev ? Math.min(ts - prev, 50) : 16;
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

  function cleanParam(key: string) {
    const u = new URL(window.location.href);
    u.searchParams.delete(key);
    window.history.replaceState({}, '', u.toString());
  }

  function readCookie(name: string): string | undefined {
    return document.cookie.split('; ').find(c => c.startsWith(`${name}=`))?.split('=').slice(1).join('=');
  }

  function clearCookie(name: string) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  onMount(() => {
    const params = $page.url.searchParams;

    // Restore any saved state from previous auth redirects
    try {
      // Restore wagwan auth state
      const savedWagwanToken = localStorage.getItem('wagwan_access_token');
      const savedWagwanUserId = localStorage.getItem('wagwan_user_id');
      if (savedWagwanToken && savedWagwanUserId) {
        wagwanVerified = true;
        wagwanAccessToken = savedWagwanToken;
        wagwanUserId = savedWagwanUserId;
        wagwanRefreshToken = localStorage.getItem('wagwan_refresh_token') || '';
      }

      const savedGoogle = localStorage.getItem('onboarding_google');
      if (savedGoogle) {
        const parsed = JSON.parse(savedGoogle);
        googleIdentity = parsed.identity;
        googleTokens = parsed.tokens;
        googleConnected = true;
      }
      const savedIg = localStorage.getItem('onboarding_ig');
      if (savedIg) {
        igIdentity = JSON.parse(savedIg);
        igConnected = true;
      }
      const savedIgToken = localStorage.getItem('onboarding_ig_token');
      if (savedIgToken) igToken = savedIgToken;
      const savedSpotify = localStorage.getItem('onboarding_spotify');
      if (savedSpotify) {
        spotifyIdentity = JSON.parse(savedSpotify);
        spotifyConnected = true;
      }
      const savedSpotifyToken = localStorage.getItem('onboarding_spotify_token');
      if (savedSpotifyToken) spotifyToken = savedSpotifyToken;
      const savedLinkedin = localStorage.getItem('onboarding_linkedin');
      if (savedLinkedin) {
        linkedinIdentity = JSON.parse(savedLinkedin);
        linkedinConnected = true;
      }
      const savedLinkedinToken = localStorage.getItem('onboarding_linkedin_token');
      if (savedLinkedinToken) linkedinToken = savedLinkedinToken;
      const savedApple = localStorage.getItem('onboarding_apple_music');
      if (savedApple) {
        appleMusicIdentity = normalizeAppleMusicIdentity(JSON.parse(savedApple));
        appleMusicConnected = true;
      }
    } catch {}

    // Google callback
    if (params.get('google_connected') === '1') {
      const idRaw = readCookie('google_identity');
      const tokRaw = readCookie('google_tokens');
      if (idRaw) { try { googleIdentity = JSON.parse(decodeURIComponent(idRaw)); } catch {} clearCookie('google_identity'); }
      if (tokRaw) { try { googleTokens = JSON.parse(decodeURIComponent(tokRaw)); } catch {} clearCookie('google_tokens'); }
      googleConnected = true;
      try { localStorage.setItem('onboarding_google', JSON.stringify({ identity: googleIdentity, tokens: googleTokens })); } catch {}
      cleanParam('google_connected');
      step = 2;
      void hydrateOnboardingFromCloud();
    }

    // Instagram callback — redeem token from URL (?ig_rt=) or cookie (callback sets both)
    if (params.get('ig_connected') === '1') {
      const redemptionToken =
        (params.get('ig_rt') || '').trim() || readCookie('ig_redemption');
      clearCookie('ig_redemption');
      clearCookie('ig_identity');
      cleanParam('ig_connected');
      cleanParam('ig_rt');

      if (!redemptionToken) {
        igError = 'Instagram could not finish (missing connection token). Try Connect again; if you use a strict browser, allow cookies for this site.';
        step = 2;
      } else {
        igConnected = true;
        step = 3;
        fetch(`/api/instagram/identity?token=${encodeURIComponent(redemptionToken)}`)
          .then(async r => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({})) as { error?: string };
              if (body.error === 'expired_or_invalid') {
                igError = 'Instagram link expired or was already used — tap Connect again.';
              } else {
                igError = 'Could not load Instagram profile — tap Connect again.';
              }
              igConnected = false;
              igIdentity = null;
              step = 2;
              return null;
            }
            return r.json();
          })
          .then(data => {
            if (!data?.identity) return;
            igIdentity = data.identity as InstagramIdentity;
            if (data.accessToken) igToken = data.accessToken;
            try { localStorage.setItem('onboarding_ig', JSON.stringify(igIdentity)); } catch {}
            try { if (igToken) localStorage.setItem('onboarding_ig_token', igToken); } catch {}
            void hydrateOnboardingFromCloud();
          })
          .catch(() => {
            igError = 'Network error loading Instagram — try again.';
            igConnected = false;
            step = 2;
          });
      }
    }

    // Spotify callback
    if (params.get('spotify') === 'connected') {
      const raw = readCookie('spotify_identity');
      if (raw) { try { spotifyIdentity = JSON.parse(decodeURIComponent(raw)); } catch {} clearCookie('spotify_identity'); }
      const sTok = readCookie('spotify_token');
      if (sTok) { spotifyToken = decodeURIComponent(sTok); clearCookie('spotify_token'); }
      spotifyConnected = true;
      try { localStorage.setItem('onboarding_spotify', JSON.stringify(spotifyIdentity)); } catch {}
      try { if (spotifyToken) localStorage.setItem('onboarding_spotify_token', spotifyToken); } catch {}
      cleanParam('spotify');
      step = 3;
    }

    // LinkedIn callback
    if (params.get('linkedin') === 'connected') {
      linkedinError = '';
      const raw = readCookie('linkedin_identity');
      let gotIdentity = false;
      if (raw) {
        try {
          linkedinIdentity = JSON.parse(decodeURIComponent(raw));
          gotIdentity = true;
        } catch {
          linkedinIdentity = null;
        }
        clearCookie('linkedin_identity');
      }
      const liTok = readCookie('linkedin_token');
      if (liTok) {
        linkedinToken = decodeURIComponent(liTok);
        clearCookie('linkedin_token');
      }
      if (gotIdentity || linkedinToken) {
        linkedinConnected = true;
        try { localStorage.setItem('onboarding_linkedin', JSON.stringify(linkedinIdentity)); } catch {}
        try { if (linkedinToken) localStorage.setItem('onboarding_linkedin_token', linkedinToken); } catch {}
      } else {
        linkedinError = 'LinkedIn login took too long or cookies were blocked — tap Connect again.';
      }
      cleanParam('linkedin');
      step = 3;
    }

    // Apple Music return from connect flow
    if (params.get('apple') === 'connected') {
      try {
        const amRaw = localStorage.getItem('onboarding_apple_music');
        if (amRaw) {
          appleMusicIdentity = normalizeAppleMusicIdentity(JSON.parse(amRaw));
          appleMusicConnected = true;
        }
      } catch {
        appleMusicIdentity = null;
        appleMusicConnected = false;
      }
      cleanParam('apple');
      step = 3;
    }

    // Error params
    if (params.get('error')?.startsWith('google_')) { googleError = 'Google connection failed — try again.'; cleanParam('error'); }
    if (params.get('ig_error')) {
      const ie = params.get('ig_error') || '';
      if (ie === 'not_configured') {
        igError = 'Instagram is not configured on the server (missing INSTAGRAM_APP_ID).';
      } else {
        try {
          igError = decodeURIComponent(ie) || 'Instagram connection failed — try again.';
        } catch {
          igError = ie || 'Instagram connection failed — try again.';
        }
      }
      cleanParam('ig_error');
    }
    const obErr = params.get('error');
    if (obErr?.startsWith('linkedin_')) {
      if (obErr === 'linkedin_not_configured') {
        linkedinError = 'LinkedIn is not configured on the server (missing API keys).';
      } else if (obErr === 'linkedin_denied') {
        linkedinError = 'LinkedIn sign-in was cancelled.';
      } else if (obErr === 'linkedin_invalid_state') {
        linkedinError = 'LinkedIn session expired — tap Connect again.';
      } else {
        linkedinError = 'LinkedIn connection failed — try again.';
      }
      cleanParam('error');
    }

    // Auto-advance based on saved state
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
      else step = 1;
    }

    if (googleConnected || igConnected) void hydrateOnboardingFromCloud();

    setTimeout(() => { fieldReady = true; startGradient(); }, 60);
  });

  onDestroy(() => { if (raf) cancelAnimationFrame(raf); });

  /** When OTP is unavailable or still being wired: skip phone+OTP and use Google / Instagram onboarding. */
  $: showSkipPhoneOtp =
    dev || import.meta.env.PUBLIC_ENABLE_SKIP_PHONE_ONBOARDING === 'true';

  function skipPhoneContinueWithOAuth() {
    wagwanError = '';
    step = 1;
  }

  function connectGoogle() { googleConnecting = true; window.location.href = '/auth/google?from=onboarding'; }
  function connectInstagram() { igConnecting = true; window.location.href = '/auth/instagram'; }
  function connectSpotify() { window.location.href = '/auth/spotify?from=onboarding'; }
  function connectLinkedIn() {
    linkedinError = '';
    window.location.href = '/auth/linkedin?from=onboarding';
  }
  function connectAppleMusic() {
    goto('/auth/applemusic/connect?from=onboarding');
  }

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
        try {
          const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
          wagwanUserId = payload.id || '';
        } catch {
          wagwanUserId = '';
        }
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

  async function hydrateOnboardingFromCloud() {
    const sub = primaryAccountKeyFromOAuthState({
      googleConnected,
      googleIdentity,
      igConnected,
      igIdentity,
    });
    if (!sub) return;
    const cloud = await fetchCloudProfile(sub);
    if (!cloud) return;
    const r = cloud.profile;

    if (r.savedItems?.length) cloudExtras.savedItems = r.savedItems;
    if (typeof r.savingsTotal === 'number') cloudExtras.savingsTotal = r.savingsTotal;
    if (r.intents?.length) cloudExtras.intents = r.intents;
    if (r.budget) cloudExtras.budget = r.budget;
    if (r.social) cloudExtras.social = r.social;

    if (!googleConnected && r.googleConnected && r.googleIdentity) {
      googleConnected = true;
      googleIdentity = r.googleIdentity as GoogleIdentity;
    }
    if (!igConnected && r.instagramConnected && r.instagramIdentity) {
      igConnected = true;
      igIdentity = r.instagramIdentity as InstagramIdentity;
    }
    if (!spotifyConnected && r.spotifyConnected && r.spotifyIdentity) {
      spotifyConnected = true;
      spotifyIdentity = r.spotifyIdentity;
    }
    if (!linkedinConnected && r.linkedinConnected && r.linkedinIdentity) {
      linkedinConnected = true;
      linkedinIdentity = r.linkedinIdentity;
    }
    if (!appleMusicConnected && r.appleMusicConnected && r.appleMusicIdentity) {
      appleMusicConnected = true;
      appleMusicIdentity = r.appleMusicIdentity;
    }
  }

  function finish() {
    finishError = '';
    const minOk =
      (googleConnected && !!googleIdentity?.sub) || (igConnected && !!igIdentity);
    if (!minOk) {
      finishError = 'Connect with Google or Instagram to continue.';
      return;
    }

    const accountSub = primaryAccountKeyFromOAuthState({
      googleConnected,
      googleIdentity,
      igConnected,
      igIdentity,
    });
    if (!accountSub) {
      finishError = 'Could not determine your account. Try connecting again.';
      return;
    }

    const name = googleIdentity?.name || igIdentity?.displayName || '';
    const city = igIdentity?.city || manualCity || '';
    const interests = igIdentity?.interests?.length ? igIdentity.interests
      : googleIdentity?.lifestyleSignals?.length ? googleIdentity.lifestyleSignals
      : ['Music', 'Food', 'Fitness', 'Nightlife'];

    const defaultIntents = ['Discovering new things', 'Music & culture', 'Food & dining'] as const;

    const fullProfile = {
      googleSub: accountSub,
      name, city, interests,
      budget: cloudExtras.budget ?? budget,
      social: (cloudExtras.social ?? 'both') as 'alone' | 'friends' | 'both',
      intents: cloudExtras.intents?.length ? cloudExtras.intents : [...defaultIntents],
      setupComplete: true,
      instagramConnected: igConnected,
      instagramIdentity: igIdentity,
      spotifyConnected,
      spotifyIdentity,
      appleMusicConnected,
      appleMusicIdentity,
      youtubeConnected: false, youtubeIdentity: null,
      googleConnected,
      googleIdentity,
      googleAccessToken: googleTokens?.accessToken ?? '',
      googleRefreshToken: googleTokens?.refreshToken ?? '',
      linkedinConnected,
      linkedinIdentity,
      savedItems: (cloudExtras.savedItems ?? []) as import('$lib/stores/profile').SavedItem[],
      savingsTotal: cloudExtras.savingsTotal ?? 0,
      lastVisit: '',
      profileUpdatedAt: new Date().toISOString(),
      locationUpdatedAt: manualCity ? new Date().toISOString() : '',
    };

    profile.set(fullProfile);

    const tokens: Record<string, string> = {};
    if (googleTokens?.accessToken) tokens.googleAccessToken = googleTokens.accessToken;
    if (googleTokens?.refreshToken) tokens.googleRefreshToken = googleTokens.refreshToken;
    if (igToken) tokens.instagramToken = igToken;
    if (spotifyToken) tokens.spotifyToken = spotifyToken;
    if (linkedinToken) tokens.linkedinToken = linkedinToken;

    fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSub: accountSub, profile: fullProfile, tokens }),
    }).catch(() => {});

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

    try {
      localStorage.removeItem('onboarding_google');
      localStorage.removeItem('onboarding_ig');
      localStorage.removeItem('onboarding_ig_token');
      localStorage.removeItem('onboarding_spotify');
      localStorage.removeItem('onboarding_spotify_token');
      localStorage.removeItem('onboarding_linkedin');
      localStorage.removeItem('onboarding_linkedin_token');
      localStorage.removeItem('onboarding_apple_music');
    } catch {}

    const q = firstQuery.trim();
    firstQuery = '';
    void goto(q ? `/profile?q=${encodeURIComponent(q)}` : '/profile');
  }

  let firstQuery = '';
</script>

<div class="ob-root">
  <!-- Gradient background -->
  <div class="ob-grad" class:ready={fieldReady}>
    <div class="ob-g ob-g--a mesh-animate" bind:this={g1}></div>
    <div class="ob-g ob-g--b mesh-animate" bind:this={g2}></div>
    <div class="ob-g ob-g--c mesh-animate" bind:this={g3}></div>
    <div class="ob-grad-vignette" aria-hidden="true"></div>
  </div>

  <div class="ob-content">
    <!-- Progress -->
    <div class="ob-progress">
      {#each [0,1,2,3,4,5] as s}
        <div class="ob-dot" class:active={step >= s} class:current={step === s}></div>
      {/each}
    </div>

    <!-- ═══ STEP 1: Google or Instagram ═══ -->
    {#if step === 1}
    <div class="ob-step screen-enter">
      <div class="ob-mark">wagwan</div>
      <h1 class="ob-h1">Let's get to<br>know each other.</h1>
      <p class="ob-sub">Connect Google or Instagram to get started. You can add the other later.</p>

      <div class="ob-explain-card">
        <ProductPreviewCard variant="calendar" />
        <p class="ob-explain-text">Your calendar reveals your schedule, inbox shows your priorities, YouTube reflects your interests.</p>
      </div>

      {#if googleError}
        <p class="ob-error">{googleError}</p>
      {/if}

      <div class="ob-bottom ob-bottom--stack">
        <button type="button" class="ob-cta" on:click={connectGoogle} disabled={googleConnecting}>
          {#if googleConnecting}
            <span class="ob-dots"><span></span><span></span><span></span></span> Connecting...
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0;"><path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          {/if}
        </button>
        <p class="ob-hint">Calendar, inbox, and YouTube — work and schedule context.</p>
        <button type="button" class="ob-cta ob-cta--ig" on:click={connectInstagram} disabled={igConnecting}>
          {igConnecting ? 'Connecting…' : 'Continue with Instagram'}
        </button>
        <p class="ob-hint">Your aesthetic, taste, and lifestyle signals.</p>
      </div>
    </div>

    <!-- ═══ STEP 2: Instagram (optional if Google ok) ═══ -->
    {:else if step === 2}
    <div class="ob-step screen-enter">
      {#if displayPicture || displayName}
        <div class="ob-user-badge">
          {#if displayPicture}
            <img src={displayPicture} alt="" class="ob-badge-pic" referrerpolicy="no-referrer" />
          {:else}
            <div class="ob-badge-initial">{displayName[0]?.toUpperCase()}</div>
          {/if}
          <div>
            <div class="ob-badge-name">Hey {displayName}</div>
            <div class="ob-badge-check">{#if googleConnected && googleIdentity?.sub}Google connected{:else}Signed in{/if}</div>
          </div>
        </div>
      {/if}

      <h1 class="ob-h1">Now show me<br>your world.</h1>
      <p class="ob-sub">
        {#if googleConnected && googleIdentity?.sub}
          Instagram is optional but sharpens recommendations. Skip if you prefer.
        {:else}
          Your aesthetic, food taste, lifestyle — this is how I really get you.
        {/if}
      </p>

      <div class="ob-explain-card">
        <ProductPreviewCard variant="instagram" />
        <p class="ob-explain-text">Your posts reveal your aesthetic, food taste, and lifestyle signals — this is how we really get you.</p>
      </div>

      {#if igError}
        <p class="ob-error">{igError}</p>
      {/if}

      <div class="ob-bottom">
        {#if igConnected && igIdentity}
          <div class="ob-connected-card">
            <div class="ob-cc-header">
              {#if igIdentity.profilePicture}
                <img src={igIdentity.profilePicture} alt="" class="ob-cc-pic" referrerpolicy="no-referrer" />
              {/if}
              <div>
                <div class="ob-cc-name">@{igIdentity.username}</div>
                <div class="ob-cc-status">Identity extracted</div>
              </div>
            </div>
            {#if igIdentity.interests?.length}
              <div class="ob-tags">
                {#each igIdentity.interests.slice(0, 5) as tag}
                  <span class="ob-tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
          <button class="ob-cta" on:click={() => step = 3}>Continue</button>
        {:else}
          <div class="ob-tag-preview">
            {#each ['Music taste', 'Food vibe', 'Aesthetic', 'Nightlife', 'Travel style'] as tag}
              <span class="ob-tag ob-tag--ghost">{tag}</span>
            {/each}
          </div>
          <button type="button" class="ob-cta ob-cta--ig" on:click={connectInstagram} disabled={igConnecting}>
            {igConnecting ? 'Connecting...' : 'Connect Instagram'}
          </button>
          {#if googleConnected && googleIdentity?.sub}
            <button type="button" class="ob-skip-link" on:click={() => (step = 3)}>Skip for now</button>
          {/if}
        {/if}
      </div>
    </div>

    <!-- ═══ STEP 3: Optional Signals ═══ -->
    {:else if step === 3}
    <div class="ob-step screen-enter">
      <h1 class="ob-h2">The more signals,<br>the sharper I get.</h1>
      <p class="ob-sub">You can always add these later from your profile.</p>

      <div class="ob-explain-card">
        <ProductPreviewCard variant="match-score" />
        <p class="ob-explain-text">Every platform you connect sharpens your recommendations and match scores.</p>
      </div>

      <div class="ob-signals">
        <!-- Spotify -->
        <div class="ob-signal-card">
          <div class="ob-signal-icon" style="background:rgba(30,215,96,0.12);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </div>
          <div class="ob-signal-body">
            <div class="ob-signal-name">Spotify</div>
            <div class="ob-signal-desc">Your music taste shapes my recommendations</div>
          </div>
          {#if spotifyConnected}
            <div class="ob-signal-check">✓</div>
          {:else}
            <button class="ob-signal-btn" on:click={connectSpotify}>Connect</button>
          {/if}
        </div>

        <!-- Apple Music -->
        <div class="ob-signal-card">
          <div class="ob-signal-icon" style="background:rgba(252,60,68,0.12);">
            <span style="font-size:20px;line-height:1;" aria-hidden="true">🎧</span>
          </div>
          <div class="ob-signal-body">
            <div class="ob-signal-name">Apple Music</div>
            <div class="ob-signal-desc">Your library shapes music and event picks</div>
          </div>
          {#if appleMusicConnected}
            <div class="ob-signal-check">✓</div>
          {:else}
            <button class="ob-signal-btn" on:click={connectAppleMusic}>Connect</button>
          {/if}
        </div>

        <!-- LinkedIn -->
        <div class="ob-signal-card">
          <div class="ob-signal-icon" style="background:rgba(0,119,181,0.12);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0077B5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </div>
          <div class="ob-signal-body">
            <div class="ob-signal-name">LinkedIn</div>
            <div class="ob-signal-desc">Career context for professional questions</div>
          </div>
          {#if linkedinConnected}
            <div class="ob-signal-check">✓</div>
          {:else}
            <button class="ob-signal-btn" on:click={connectLinkedIn}>Connect</button>
          {/if}
        </div>
      </div>

      {#if linkedinError}
        <p class="ob-error" role="alert">{linkedinError}</p>
      {/if}

      <div class="ob-bottom">
        <button class="ob-cta" on:click={() => step = 4}>Continue</button>
      </div>
    </div>

    <!-- ═══ STEP 4: Identity Snapshot ═══ -->
    {:else if step === 4}
    <div class="ob-step screen-enter">
      <h1 class="ob-h2">Here's what I<br>know about you.</h1>
      <p class="ob-sub">This is just the start — I learn more every time we talk.</p>

      <div class="ob-identity-card">
        {#if displayPicture}
          <img src={displayPicture} alt="" class="ob-id-pic" referrerpolicy="no-referrer" />
        {:else if displayName}
          <div class="ob-id-initial">{displayName[0]?.toUpperCase()}</div>
        {/if}
        <div class="ob-id-name">{googleIdentity?.name || igIdentity?.displayName || displayName}</div>
        {#if autoCity}<div class="ob-id-city">{autoCity}</div>{/if}

        {#if personalTags.length > 0}
          <div class="ob-id-tags">
            {#each personalTags as tag}
              <span class="ob-tag">{tag}</span>
            {/each}
          </div>
        {/if}

        {#if igIdentity?.aesthetic}
          <div class="ob-id-vibe">{igIdentity.aesthetic}</div>
        {/if}

        <div class="ob-id-signals">
          {#if googleConnected}<span class="ob-id-signal">Google</span>{/if}
          {#if igConnected}<span class="ob-id-signal">Instagram</span>{/if}
          {#if spotifyConnected}<span class="ob-id-signal">Spotify</span>{/if}
          {#if appleMusicConnected}<span class="ob-id-signal">Apple Music</span>{/if}
          {#if linkedinConnected}<span class="ob-id-signal">LinkedIn</span>{/if}
        </div>
      </div>

      <div class="ob-budget-row">
        <p class="ob-budget-label">How do you usually spend?</p>
        <div class="ob-budget-pills">
          {#each [
            { v: 'low', label: 'Budget', desc: 'Under ₹500' },
            { v: 'mid', label: 'Mid-range', desc: '₹500–₹3k' },
            { v: 'high', label: 'Premium', desc: '₹3k+' },
          ] as opt}
            <button class="ob-budget" class:active={budget === opt.v} on:click={() => budget = opt.v as 'low'|'mid'|'high'}>
              <span class="ob-budget-name">{opt.label}</span>
              <span class="ob-budget-desc">{opt.desc}</span>
            </button>
          {/each}
        </div>
      </div>

      {#if !autoCity}
        <input type="text" bind:value={manualCity} placeholder="Your city (e.g. Mumbai)" class="ob-city-input" />
      {/if}

      <div class="ob-bottom">
        <button class="ob-cta" on:click={() => step = 5}>Continue</button>
      </div>
    </div>

    <!-- ═══ STEP 5: Ready ═══ -->
    {:else if step === 5}
    <div class="ob-step screen-enter" style="text-align:center;">
      <div class="ob-ready-glow"></div>
      <h1 class="ob-h1" style="margin-top:20vh;">Your twin<br>is ready.</h1>
      <p class="ob-sub" style="margin-bottom:32px;">Ask me anything to get started.</p>

      {#if finishError}
        <p class="ob-error" role="alert" style="max-width:320px;margin:0 auto 16px;text-align:center;">{finishError}</p>
      {/if}

      <div class="ob-starter-chips">
        {#each ['What should I do this weekend?', 'Summarise my day', 'Find me a good restaurant'] as chip}
          <button class="ob-starter" on:click={() => { firstQuery = chip; finish(); }}>{chip}</button>
        {/each}
      </div>

      <div class="ob-bottom">
        <button class="ob-cta" on:click={finish}>Start exploring</button>
      </div>
    </div>
    {/if}
  </div>
</div>

<style>
  .ob-root {
    position: fixed; inset: 0;
    background: var(--bg-primary);
    overflow: hidden;
    font-family: var(--font-sans);
  }

  .ob-grad {
    position: absolute; inset: 0;
    opacity: 0;
    transition: opacity 2s ease;
  }
  .ob-grad.ready { opacity: 1; }

  .ob-g {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
    transform: translate(-50%, -50%);
  }

  .ob-g--a {
    width: 110vw;
    height: 110vw;
    left: 30%;
    top: 20%;
    background: radial-gradient(ellipse at center, var(--ambient-blue) 0%, transparent 70%);
    filter: blur(calc(72px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.52 * var(--mesh-orb-opacity-scale, 1));
  }

  .ob-g--b {
    width: 85vw;
    height: 85vw;
    left: 60%;
    top: 55%;
    background: radial-gradient(ellipse at center, var(--ambient-red) 0%, transparent 70%);
    filter: blur(calc(64px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.32 * var(--mesh-orb-opacity-scale, 1));
  }

  .ob-g--c {
    width: 130vw;
    height: 130vw;
    left: 40%;
    top: 35%;
    background: radial-gradient(ellipse at center, var(--ambient-gold) 0%, transparent 72%);
    filter: blur(calc(90px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.38 * var(--mesh-orb-opacity-scale, 1));
  }

  .ob-grad-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 50%,
      transparent 40%,
      color-mix(in srgb, var(--bg-primary) 82%, #000) 100%
    );
    pointer-events: none;
  }

  .ob-content {
    position: absolute; inset: 0;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .ob-progress {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: max(20px, env(safe-area-inset-top, 20px)) 0 0;
    flex-shrink: 0;
  }

  .ob-dot {
    width: 6px; height: 6px;
    border-radius: 100px;
    background: var(--border-strong);
    transition: all 0.3s ease;
  }
  .ob-dot.active { background: var(--accent-primary); }
  .ob-dot.current { width: 20px; }

  .ob-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 32px 28px 0;
    min-height: 0;
  }

  .ob-mark {
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    margin-bottom: 48px;
  }

  .ob-h1 {
    font-size: clamp(40px, 11vw, 56px);
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0 0 16px;
  }

  .ob-h2 {
    font-size: clamp(28px, 8vw, 38px);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0 0 12px;
  }

  .ob-sub {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: min(22rem, 100%);
    margin: 0;
  }

  .ob-error {
    font-size: 13px;
    color: var(--state-error);
    margin: 12px 0 0;
  }

  .ob-bottom {
    margin-top: auto;
    padding: 24px 0 max(28px, env(safe-area-inset-bottom, 28px));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ob-bottom--stack {
    gap: 10px;
  }

  .ob-skip-link {
    margin-top: 4px;
    align-self: center;
    background: none;
    border: none;
    color: var(--accent-primary);
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    padding: 10px 8px;
  }

  .ob-skip-link--block {
    width: 100%;
    align-self: stretch;
    text-align: center;
  }

  .ob-cta {
    width: 100%;
    padding: 16px 24px;
    border-radius: 100px;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    border: none;
    color: white;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 20px rgba(255, 77, 77, 0.3);
    transition: transform 0.15s, opacity 0.15s;
  }
  .ob-cta:active { transform: scale(0.97); }
  .ob-cta:disabled { opacity: 0.5; cursor: default; }

  .ob-cta--ig {
    background: linear-gradient(135deg, #833AB4, #FD1D1D, #F77737);
    box-shadow: 0 4px 20px rgba(131,58,180,0.3);
  }

  .ob-hint {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
  }

  .ob-dots {
    display: inline-flex; gap: 3px; align-items: center;
  }
  .ob-dots span {
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--text-muted);
    animation: dot-pulse 1.2s ease-in-out infinite;
  }
  .ob-dots span:nth-child(2) { animation-delay: 0.2s; }
  .ob-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes dot-pulse {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* User badge */
  .ob-user-badge {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 24px;
  }
  .ob-badge-pic {
    width: 48px; height: 48px; border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--accent-soft);
  }
  .ob-badge-initial {
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 800; color: white;
  }
  .ob-badge-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
  .ob-badge-check { font-size: 12px; color: var(--state-success); margin-top: 2px; }

  /* Connected card */
  .ob-connected-card {
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 16px;
    backdrop-filter: blur(var(--blur-medium));
    margin-bottom: 16px;
  }
  .ob-cc-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .ob-cc-pic { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .ob-cc-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .ob-cc-status { font-size: 12px; color: var(--state-success); }

  /* Tags */
  .ob-tags, .ob-tag-preview { display: flex; flex-wrap: wrap; gap: 6px; }
  .ob-tag-preview { margin-bottom: 20px; }
  .ob-tag {
    font-size: 12px;
    padding: 5px 12px;
    border-radius: 100px;
    background: var(--accent-soft);
    color: var(--accent-primary);
    border: 1px solid var(--accent-glow);
  }
  .ob-tag--ghost {
    background: var(--glass-light);
    color: var(--text-muted);
    border-color: var(--border-subtle);
  }

  /* Signal cards (Step 3) */
  .ob-signals {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 24px;
  }
  .ob-signal-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    backdrop-filter: blur(var(--blur-light));
  }
  .ob-signal-icon {
    width: 44px; height: 44px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .ob-signal-body { flex: 1; min-width: 0; }
  .ob-signal-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .ob-signal-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .ob-signal-btn {
    padding: 8px 16px;
    border-radius: 100px;
    background: var(--glass-medium);
    border: 1px solid var(--border-strong);
    color: var(--text-primary);
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .ob-signal-btn:hover { background: var(--glass-strong); }
  .ob-signal-check {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: rgba(74,222,128,0.15);
    color: var(--state-success);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700;
    flex-shrink: 0;
  }

  /* Identity card (Step 4) */
  .ob-identity-card {
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    padding: 24px;
    backdrop-filter: blur(var(--blur-medium));
    margin-top: 20px;
    text-align: center;
  }
  .ob-id-pic {
    width: 72px; height: 72px;
    border-radius: 50%;
    object-fit: cover;
    margin: 0 auto 12px;
    display: block;
    border: 2px solid var(--accent-soft);
  }
  .ob-id-initial {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 800; color: white;
    margin: 0 auto 12px;
  }
  .ob-id-name { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .ob-id-city { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
  .ob-id-tags { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 16px; }
  .ob-id-vibe { font-size: 13px; color: var(--text-secondary); margin-top: 12px; font-style: italic; }
  .ob-id-signals { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
  .ob-id-signal {
    font-size: 11px; font-weight: 600;
    padding: 4px 10px;
    border-radius: 100px;
    background: var(--glass-light);
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
  }

  /* Budget */
  .ob-budget-row { margin-top: 20px; }
  .ob-budget-label { font-size: 13px; color: var(--text-secondary); margin: 0 0 10px; }
  .ob-budget-pills { display: flex; gap: 8px; }
  .ob-budget {
    flex: 1;
    padding: 12px 8px;
    border-radius: 14px;
    background: var(--glass-light);
    border: 1.5px solid var(--border-subtle);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
  }
  .ob-budget.active {
    border-color: var(--accent-glow);
    background: var(--accent-soft);
  }
  .ob-budget-name {
    font-size: 13px; font-weight: 700;
    color: var(--text-primary);
    display: block;
  }
  .ob-budget-desc {
    font-size: 10px;
    color: var(--text-muted);
    display: block;
    margin-top: 2px;
  }

  .ob-city-input {
    width: 100%;
    padding: 14px 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    margin-top: 16px;
  }
  .ob-city-input::placeholder { color: var(--text-muted); }

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

  /* Unlock preview card (Step 0) */
  .ob-unlock-card {
    margin-top: 24px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 16px;
    backdrop-filter: blur(var(--blur-light));
  }
  .ob-unlock-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }
  .ob-unlock-items { display: flex; flex-direction: column; gap: 10px; }
  .ob-unlock-item {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: var(--text-secondary);
  }
  .ob-unlock-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .ob-unlock-dot--red { background: #FF4D4D; }
  .ob-unlock-dot--blue { background: #4D7CFF; }
  .ob-unlock-dot--gold { background: #FFB84D; }

  .ob-location-field {
    margin-top: 16px;
  }
  .ob-location-hint {
    font-size: 11px;
    color: var(--text-muted);
    display: block;
    margin-top: 6px;
  }

  /* Explain cards (Steps 1-3) */
  .ob-explain-card {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ob-explain-text {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
  }

  /* Ready (Step 5) */
  .ob-ready-glow {
    position: absolute;
    width: 200px; height: 200px;
    left: 50%; top: 25%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent-glow), transparent 70%);
    filter: blur(40px);
    animation: pulse-ready 3s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes pulse-ready {
    0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
  }

  .ob-starter-chips {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: min(28rem, 100%);
    margin: 0 auto;
  }
  .ob-starter {
    padding: 12px 20px;
    border-radius: 100px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    backdrop-filter: blur(var(--blur-light));
    transition: background 0.15s, color 0.15s;
    text-align: left;
  }
  .ob-starter:hover {
    background: var(--glass-medium);
    color: var(--text-primary);
  }

  :global(.screen-enter) {
    animation: screenIn 0.4s ease both;
  }
  @keyframes screenIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (min-width: 768px) {
    .ob-step {
      max-width: min(36rem, 100%);
      margin-left: auto;
      margin-right: auto;
      width: 100%;
      padding-left: max(28px, env(safe-area-inset-left));
      padding-right: max(28px, env(safe-area-inset-right));
    }
    .ob-sub {
      max-width: min(28rem, 100%);
    }
  }
</style>
