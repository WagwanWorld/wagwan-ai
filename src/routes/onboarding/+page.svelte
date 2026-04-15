<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { profile } from '$lib/stores/profile';
  import type { GoogleIdentity } from '$lib/utils';
  import { primaryAccountKeyFromOAuthState } from '$lib/auth/accountKey';
  import { fetchCloudProfile } from '$lib/auth/profileRemote';

  let googleConnected = false;
  let googleIdentity: GoogleIdentity | null = null;
  let googleTokens: { accessToken: string; refreshToken: string } | null = null;
  let connecting = false;
  let error = '';
  let finishing = false;
  let city = '';
  let showCityStep = false;

  function readCookie(name: string): string {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function clearCookie(name: string) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  onMount(async () => {
    // Check if already set up
    const existing = $profile;
    if (existing?.setupComplete && existing?.googleSub) {
      goto('/home', { replaceState: true });
      return;
    }

    // Restore from localStorage if returning from OAuth
    try {
      const saved = localStorage.getItem('onboarding_google');
      if (saved) {
        const { identity, tokens } = JSON.parse(saved);
        if (identity?.sub) {
          googleIdentity = identity;
          googleTokens = tokens;
          googleConnected = true;
        }
      }
    } catch {}

    // Handle Google callback
    const params = $page.url.searchParams;
    if (params.get('google_connected') === '1') {
      const idRaw = readCookie('google_identity');
      const tokRaw = readCookie('google_tokens');
      if (idRaw) { try { googleIdentity = JSON.parse(decodeURIComponent(idRaw)); } catch {} clearCookie('google_identity'); }
      if (tokRaw) { try { googleTokens = JSON.parse(decodeURIComponent(tokRaw)); } catch {} clearCookie('google_tokens'); }
      googleConnected = true;
      try { localStorage.setItem('onboarding_google', JSON.stringify({ identity: googleIdentity, tokens: googleTokens })); } catch {}

      // Show city step after Google connect
      showCityStep = true;
    }
  });

  function connectGoogle() {
    connecting = true;
    window.location.href = '/auth/google?from=onboarding';
  }

  async function finishSetup() {
    finishing = true;
    error = '';

    if (!googleConnected || !googleIdentity?.sub) {
      error = 'Connect with Google to continue.';
      finishing = false;
      return;
    }

    const accountSub = googleIdentity.sub;

    // Try to hydrate from cloud
    let cloudExtras: Record<string, unknown> = {};
    try {
      const cloud = await fetchCloudProfile(accountSub);
      if (cloud?.profile) {
        const r = cloud.profile;
        if (r.savedItems?.length) cloudExtras.savedItems = r.savedItems;
        if (typeof r.savingsTotal === 'number') cloudExtras.savingsTotal = r.savingsTotal;
        if (r.intents?.length) cloudExtras.intents = r.intents;
        if (r.budget) cloudExtras.budget = r.budget;
        if (r.social) cloudExtras.social = r.social;
      }
    } catch {}

    const name = googleIdentity.name || '';
    const interests = googleIdentity.lifestyleSignals?.length
      ? googleIdentity.lifestyleSignals
      : ['Music', 'Food', 'Fitness', 'Nightlife'];

    const defaultIntents = ['Discovering new things', 'Music & culture', 'Food & dining'];

    const fullProfile = {
      googleSub: accountSub,
      name,
      city: city.trim(),
      interests,
      budget: (cloudExtras.budget as string) ?? 'mid',
      social: ((cloudExtras.social as string) ?? 'both') as 'alone' | 'friends' | 'both',
      intents: (cloudExtras.intents as string[])?.length ? cloudExtras.intents as string[] : defaultIntents,
      setupComplete: true,
      instagramConnected: false,
      instagramIdentity: null,
      spotifyConnected: false,
      spotifyIdentity: null,
      appleMusicConnected: false,
      appleMusicIdentity: null,
      youtubeConnected: false,
      youtubeIdentity: null,
      googleConnected: true,
      googleIdentity,
      googleAccessToken: googleTokens?.accessToken ?? '',
      googleRefreshToken: googleTokens?.refreshToken ?? '',
      linkedinConnected: false,
      linkedinIdentity: null,
      savedItems: (cloudExtras.savedItems ?? []) as import('$lib/stores/profile').SavedItem[],
      savingsTotal: (cloudExtras.savingsTotal as number) ?? 0,
      lastVisit: '',
      profileUpdatedAt: new Date().toISOString(),
      locationUpdatedAt: '',
    };

    profile.set(fullProfile);

    const tokens: Record<string, string> = {};
    if (googleTokens?.accessToken) tokens.googleAccessToken = googleTokens.accessToken;
    if (googleTokens?.refreshToken) tokens.googleRefreshToken = googleTokens.refreshToken;

    // Save to cloud (fire and forget)
    fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSub: accountSub, profile: fullProfile, tokens }),
    }).catch(() => {});

    try {
      localStorage.removeItem('onboarding_google');
    } catch {}

    goto('/home', { replaceState: true });
  }
</script>

<div class="onboard">
  <div class="onboard-card">
    <div class="onboard-logo">w.</div>
    <h1 class="onboard-title">Welcome to Wagwan</h1>
    <p class="onboard-sub">Connect your Google account to get started. Takes 10 seconds.</p>

    {#if error}
      <p class="onboard-error">{error}</p>
    {/if}

    {#if finishing}
      <div class="onboard-finishing">
        <div class="spinner"></div>
        <p>Setting up your profile...</p>
      </div>
    {:else if showCityStep && googleConnected}
      <div class="onboard-connected">
        <div class="connected-check">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4L16 6" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="connected-name">{googleIdentity?.name ?? 'Connected'}</span>
      </div>
      <div class="city-field">
        <label for="city">Where are you based?</label>
        <input
          id="city"
          type="text"
          bind:value={city}
          placeholder="Mumbai, Bangalore, Delhi..."
          on:keydown={(e) => { if (e.key === 'Enter' && city.trim()) finishSetup(); }}
        />
      </div>
      <button class="onboard-btn" on:click={finishSetup} disabled={!city.trim()}>
        Let's go
      </button>
      <button class="skip-btn" on:click={finishSetup}>
        Skip for now
      </button>
    {:else if googleConnected}
      <div class="onboard-connected">
        <div class="connected-check">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4L16 6" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="connected-name">{googleIdentity?.name ?? 'Connected'}</span>
      </div>
      <button class="onboard-btn" on:click={() => showCityStep = true}>
        Continue
      </button>
    {:else}
      <button class="onboard-btn onboard-btn--google" on:click={connectGoogle} disabled={connecting}>
        {#if connecting}
          <div class="spinner spinner--sm"></div>
        {:else}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        {/if}
      </button>
    {/if}

    <p class="onboard-legal">
      By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
    </p>
  </div>
</div>

<style>
  .onboard {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bg-primary, #0a0a0f);
  }

  .onboard-card {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
  }

  .onboard-logo {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary, #e8ecf3);
    letter-spacing: -0.04em;
  }

  .onboard-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary, #e8ecf3);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .onboard-sub {
    font-size: 14px;
    color: var(--text-muted, #6d7684);
    margin: -8px 0 0;
    line-height: 1.5;
  }

  .onboard-error {
    font-size: 13px;
    color: #FF4D4D;
    margin: 0;
    padding: 8px 16px;
    background: rgba(255, 77, 77, 0.08);
    border-radius: 8px;
  }

  .onboard-btn {
    width: 100%;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: opacity 0.15s, transform 0.15s;
    min-height: 48px;
  }

  .onboard-btn:hover:not(:disabled) { opacity: 0.9; }
  .onboard-btn:active:not(:disabled) { transform: scale(0.98); }
  .onboard-btn:disabled { opacity: 0.5; cursor: default; }

  .onboard-btn--google {
    background: white;
    color: #333;
  }

  .onboard-btn:not(.onboard-btn--google) {
    background: var(--accent-primary, #FF4D4D);
    color: white;
  }

  .onboard-connected {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: rgba(52, 211, 153, 0.08);
    border: 1px solid rgba(52, 211, 153, 0.2);
    border-radius: 12px;
    width: 100%;
    justify-content: center;
  }

  .connected-check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(52, 211, 153, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .connected-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e8ecf3);
  }

  .onboard-finishing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
  }

  .onboard-finishing p {
    font-size: 14px;
    color: var(--text-muted, #6d7684);
    margin: 0;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2.5px solid rgba(255,255,255,0.15);
    border-top-color: var(--accent-primary, #FF4D4D);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .spinner--sm {
    width: 18px;
    height: 18px;
    border-width: 2px;
    border-color: rgba(0,0,0,0.15);
    border-top-color: #333;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .onboard-legal {
    font-size: 12px;
    color: var(--text-muted, #6d7684);
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .onboard-legal a {
    color: var(--text-secondary, #9aa3b2);
    text-decoration: none;
  }

  .city-field {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .city-field label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #9aa3b2);
  }

  .city-field input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 15px;
    color: var(--text-primary, #e8ecf3);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .city-field input:focus {
    border-color: var(--accent-primary, #FF4D4D);
  }

  .city-field input::placeholder {
    color: var(--text-muted, #6d7684);
  }

  .skip-btn {
    background: none;
    border: none;
    font-size: 13px;
    color: var(--text-muted, #6d7684);
    font-family: inherit;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.15s;
  }

  .skip-btn:hover {
    color: var(--text-secondary, #9aa3b2);
  }

  .onboard-legal a:hover {
    text-decoration: underline;
  }
</style>
