<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { profile } from '$lib/stores/profile';
  import { syncProfileToSupabase } from '$lib/client/syncProfileToSupabase';
  import { goto } from '$app/navigation';
  import type { InstagramIdentity } from '$lib/server/instagram';
  import type { SpotifyIdentity, AppleMusicIdentity, YouTubeIdentity, LinkedInIdentity, GoogleIdentity } from '$lib/utils';
  import {
    clearChatMemory,
    exportChatMemoryJson,
    loadChatMemory,
    memoryKeyForProfile,
    type ChatMemoryState,
  } from '$lib/stores/chatMemory';
  import {
    clearTwinMemory as clearTwinMem,
    memoryKeyForProfile as twinMemKey,
    loadTwinMemory,
  } from '$lib/stores/twinMemory';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
  import { buildProfileTwinKnows } from '$lib/utils/googleInsightMapper';
  import { twinUiContext } from '$lib/stores/contextStore';
  import { prefetchArtistArtwork } from '$lib/client/itunesArtwork';

  // iTunes artwork cache (keyed by artist name) — shared module handles network + dedupe
  let itunesArtwork: Record<string, string> = {};

  async function fetchItunesArtwork(artists: string[]): Promise<void> {
    const toFetch = artists.slice(0, 5).filter(a => a && !itunesArtwork[a]);
    if (!toFetch.length) return;
    const batch = await prefetchArtistArtwork(toFetch);
    itunesArtwork = { ...itunesArtwork, ...batch };
  }

  $: {
    const amArtists = $profile.appleMusicIdentity?.topArtists ?? [];
    const spArtists = $profile.spotifyIdentity?.topArtists ?? [];
    const artists = amArtists.length ? amArtists : spArtists;
    if (artists.length) void fetchItunesArtwork(artists);
  }

  function relativeTime(iso: string | undefined): string {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 2) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  let refreshing = false;
  let refreshResult: { expired: string[] } | null = null;
  let connectError = '';

  let graphStrength: {
    score: number;
    label: string;
    source_count: number;
    freshness_bucket: string;
    tag_count: number;
  } | null = null;
  let graphStrengthLoading = false;

  async function loadGraphStrength() {
    const sub = get(profile).googleSub;
    if (!sub) {
      graphStrength = null;
      return;
    }
    graphStrengthLoading = true;
    try {
      const r = await fetch(`/api/user/graph-strength?sub=${encodeURIComponent(sub)}`);
      const j = await r.json();
      if (j.ok) {
        graphStrength = {
          score: j.score,
          label: j.label,
          source_count: j.source_count,
          freshness_bucket: j.freshness_bucket,
          tag_count: j.tag_count,
        };
      } else {
        graphStrength = null;
      }
    } catch {
      graphStrength = null;
    } finally {
      graphStrengthLoading = false;
    }
  }

  $: googleTwinInsights = buildProfileTwinKnows($profile.googleIdentity?.twin);
  let refreshError = '';

  $: profilePic = $profile.instagramIdentity?.profilePicture || $profile.googleIdentity?.picture || '';
  $: displayName = $profile.name || 'You';
  $: city = $profile.city || $profile.instagramIdentity?.city || '';
  $: ig = $profile.instagramIdentity;
  $: aesthetic = ig?.aesthetic || '';
  $: personalTags = (() => {
    const tags: string[] = [];
    if (ig?.interests?.length) tags.push(...ig.interests.slice(0, 5));
    else if ($profile.interests?.length) tags.push(...$profile.interests.slice(0, 5));
    if (ig?.brandVibes?.length) tags.push(...ig.brandVibes.slice(0, 2));
    return [...new Set(tags)].slice(0, 7);
  })();

  $: learnedFacts = (() => {
    const key = twinMemKey($profile);
    const mem = loadTwinMemory(key);
    return mem.facts.slice(-8);
  })();

  interface PlatformInfo {
    name: string;
    connected: boolean;
    icon: string;
    color: string;
    connect: () => void;
    disconnect: () => void;
  }

  $: platforms = [
    { name: 'Google', connected: $profile.googleConnected, icon: '🔵', color: '#4285F4',
      connect: () => { window.location.href = '/auth/google?from=profile'; },
      disconnect: () => { profile.update(p => ({ ...p, googleConnected: false, googleIdentity: null, googleAccessToken: '', googleRefreshToken: '' })); } },
    { name: 'Instagram', connected: $profile.instagramConnected, icon: '📸', color: '#E1306C',
      connect: () => { window.location.href = '/auth/instagram?from=profile'; },
      disconnect: () => { profile.update(p => ({ ...p, instagramConnected: false, instagramIdentity: null })); } },
    { name: 'Spotify', connected: $profile.spotifyConnected, icon: '🎵', color: '#1DB954',
      connect: () => { window.location.href = '/auth/spotify?from=profile'; },
      disconnect: () => { profile.update(p => ({ ...p, spotifyConnected: false, spotifyIdentity: null })); } },
    { name: 'LinkedIn', connected: $profile.linkedinConnected, icon: '💼', color: '#0077B5',
      connect: () => { window.location.href = '/auth/linkedin?from=profile'; },
      disconnect: () => { profile.update(p => ({ ...p, linkedinConnected: false, linkedinIdentity: null })); } },
    { name: 'Apple Music', connected: $profile.appleMusicConnected, icon: '🎧', color: '#FC3C44',
      connect: () => { window.location.href = '/auth/applemusic/connect?from=profile'; },
      disconnect: async () => {
        const sub = $profile.googleSub;
        profile.update(p => ({ ...p, appleMusicConnected: false, appleMusicIdentity: null }));
        if (sub) await syncProfileToSupabase(get(profile), { appleMusicUserToken: '' });
      } },
    { name: 'YouTube', connected: $profile.youtubeConnected, icon: '📺', color: '#FF0000',
      connect: () => { window.location.href = '/auth/youtube?from=profile'; },
      disconnect: () => { profile.update(p => ({ ...p, youtubeConnected: false, youtubeIdentity: null })); } },
  ] as PlatformInfo[];

  $: connectedCount = platforms.filter(p => p.connected).length;

  async function clearCloudTwinChat(googleSub: string | undefined) {
    if (!googleSub) return;
    try {
      await fetch('/api/chat/thread', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSub,
          thread: { version: 2, updatedAt: new Date().toISOString(), messages: [], summary: '' },
        }),
      });
    } catch {
      /* ignore */
    }
  }

  function resetApp() {
    if (!confirm('Reset all your data and start over?')) return;
    const sub = get(profile).googleSub;
    clearChatMemory(memoryKeyForProfile($profile));
    clearTwinMem(twinMemKey($profile));
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('wagwan_home_') || k.startsWith('wagwan_google_'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    void clearCloudTwinChat(sub);
    profile.reset();
    goto('/onboarding');
  }

  function clearTwinMemory() {
    if (!confirm('Clear saved twin chat and learned memory on this device?')) return;
    const sub = get(profile).googleSub;
    clearChatMemory(memoryKeyForProfile($profile));
    clearTwinMem(twinMemKey($profile));
    void clearCloudTwinChat(sub);
  }

  function exportTwinMemory() {
    const key = memoryKeyForProfile($profile);
    const mem: ChatMemoryState = loadChatMemory(key);
    const blob = new Blob([exportChatMemoryJson(mem)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wagwan-twin-memory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function readCookie(name: string): string | undefined {
    return document.cookie.split('; ').find(c => c.startsWith(`${name}=`))?.split('=').slice(1).join('=');
  }

  function clearCookieByName(name: string) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  async function refreshSignals() {
    const sub = $profile.googleSub;
    if (!sub || refreshing) return;

    refreshing = true;
    refreshResult = null;
    refreshError = '';

    try {
      const res = await fetch('/api/refresh-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSub: sub }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        refreshError = data.error || 'Failed to refresh signals';
        return;
      }

      const data = await res.json();
      refreshResult = { expired: data.expired ?? [] };

      if (data.updated) {
        profile.update(p => ({
          ...p,
          ...(data.updated as Partial<typeof p>),
          profileUpdatedAt: data.updatedAt || new Date().toISOString(),
        }));
      }

      // Clear feed caches so next visit gets fresh content
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('wagwan_home_') || k.startsWith('wagwan_google_'))
          .forEach(k => localStorage.removeItem(k));
      } catch {}
    } catch {
      refreshError = 'Network error — please try again.';
    } finally {
      refreshing = false;
      void loadGraphStrength();
    }
  }

  onMount(() => {
    void (async () => {
    const searchParams = $page.url.searchParams;
    const errorParam = searchParams.get('error');
    if (errorParam) {
      connectError =
        errorParam === 'linkedin_denied' ? 'LinkedIn sign-in was cancelled.' :
        errorParam === 'linkedin_failed' ? 'LinkedIn connection failed — check server logs.' :
        errorParam === 'linkedin_not_configured' ? 'LinkedIn is not configured.' :
        `Connection error: ${errorParam}`;
      const u = new URL(window.location.href);
      u.searchParams.delete('error');
      window.history.replaceState({}, '', u.toString());
    }
    const igErr = searchParams.get('ig_error');
    if (igErr) {
      connectError =
        igErr === 'not_configured'
          ? 'Instagram is not configured on the server (missing INSTAGRAM_APP_ID).'
          : (() => {
              try {
                return decodeURIComponent(igErr);
              } catch {
                return igErr;
              }
            })();
      const u = new URL(window.location.href);
      u.searchParams.delete('ig_error');
      window.history.replaceState({}, '', u.toString());
    }
    if (searchParams.get('spotify') === 'connected') {
      const spotifyTokRaw = readCookie('spotify_token');
      if (spotifyTokRaw) clearCookieByName('spotify_token');
      const cookie = document.cookie.split('; ').find(c => c.startsWith('spotify_identity='));
      if (cookie) {
        try {
          const identity: SpotifyIdentity = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
          profile.update(p => ({ ...p, spotifyConnected: true, spotifyIdentity: identity }));
          document.cookie = 'spotify_identity=; max-age=0; path=/';
        } catch {}
      } else {
        profile.update(p => ({ ...p, spotifyConnected: true }));
      }
      const st = spotifyTokRaw ? decodeURIComponent(spotifyTokRaw) : '';
      if (get(profile).googleSub) {
        await syncProfileToSupabase(get(profile), st ? { spotifyToken: st } : undefined);
      }
    }
    if (searchParams.get('youtube') === 'connected') {
      const ytCookie = document.cookie.split('; ').find(c => c.startsWith('youtube_identity='));
      if (ytCookie) {
        try {
          const identity: YouTubeIdentity = JSON.parse(decodeURIComponent(ytCookie.split('=')[1]));
          profile.update(p => ({ ...p, youtubeConnected: true, youtubeIdentity: identity }));
          document.cookie = 'youtube_identity=; max-age=0; path=/';
        } catch {}
      } else {
        profile.update(p => ({ ...p, youtubeConnected: true }));
      }
    }
    if (searchParams.get('google') === 'connected') {
      const gCookie = document.cookie.split('; ').find(c => c.startsWith('google_identity='));
      const tCookie = document.cookie.split('; ').find(c => c.startsWith('google_tokens='));
      if (gCookie) {
        try {
          const identity: GoogleIdentity = JSON.parse(decodeURIComponent(gCookie.split('=')[1]));
          const tokens = tCookie ? JSON.parse(decodeURIComponent(tCookie.split('=')[1])) : {};
          profile.update(p => ({ ...p, googleConnected: true, googleIdentity: identity, googleAccessToken: tokens.accessToken ?? '', googleRefreshToken: tokens.refreshToken ?? '' }));
          document.cookie = 'google_identity=; max-age=0; path=/';
          document.cookie = 'google_tokens=; max-age=0; path=/';
          if (get(profile).googleSub) await syncProfileToSupabase(get(profile));
        } catch {}
      }
    }
    if (searchParams.get('linkedin') === 'connected') {
      const liTokRaw = readCookie('linkedin_token');
      if (liTokRaw) clearCookieByName('linkedin_token');
      const liRaw = readCookie('linkedin_identity');
      if (liRaw) document.cookie = 'linkedin_identity=; max-age=0; path=/';
      let liIdentity: LinkedInIdentity | null = null;
      if (liRaw) {
        try {
          liIdentity = JSON.parse(decodeURIComponent(liRaw)) as LinkedInIdentity;
        } catch {}
      }
      // Mark connected regardless of whether identity parsed — user successfully authenticated
      profile.update(p => ({ ...p, linkedinConnected: true, ...(liIdentity ? { linkedinIdentity: liIdentity } : {}) }));
      // Clean up URL
      const u = new URL(window.location.href);
      u.searchParams.delete('linkedin');
      window.history.replaceState({}, '', u.toString());
      const lt = liTokRaw ? decodeURIComponent(liTokRaw) : '';
      if (get(profile).googleSub) {
        await syncProfileToSupabase(get(profile), lt ? { linkedinToken: lt } : undefined);
      }
    }
    if (searchParams.get('apple') === 'connected' && get(profile).googleSub) {
      await syncProfileToSupabase(get(profile));
    }

    // Instagram callback (from profile reconnection)
    if (searchParams.get('ig_connected') === '1') {
      const redemptionToken =
        (searchParams.get('ig_rt') || '').trim() || readCookie('ig_redemption');
      clearCookieByName('ig_redemption');
      clearCookieByName('ig_identity');

      const u = new URL(window.location.href);
      u.searchParams.delete('ig_connected');
      u.searchParams.delete('ig_rt');
      window.history.replaceState({}, '', u.toString());

      if (!redemptionToken) {
        connectError = 'Instagram could not finish (missing token). Tap Connect again.';
      } else {
        profile.update(p => ({ ...p, instagramConnected: true }));
        fetch(`/api/instagram/identity?token=${encodeURIComponent(redemptionToken)}`)
          .then(async r => {
            if (!r.ok) {
              connectError = 'Could not load Instagram profile — tap Connect again.';
              profile.update(p => ({ ...p, instagramConnected: false }));
              return null;
            }
            return r.json();
          })
          .then(async data => {
            if (data?.identity) {
              profile.update(p => ({
                ...p,
                instagramIdentity: data.identity as InstagramIdentity,
              }));
              if (get(profile).googleSub) await syncProfileToSupabase(get(profile));
            }
          })
          .catch(() => {
            connectError = 'Instagram connection failed — try again.';
            profile.update(p => ({ ...p, instagramConnected: false }));
          });
      }
    }
    await loadGraphStrength();
    })();
  });
</script>

<div class="profile-page-root" data-profile-surface="dark">
  <div class="profile-aurora" aria-hidden="true"></div>
  <div class="pf">
  {#if connectError}
    <div class="pf-connect-error" role="alert">{connectError}</div>
  {/if}
  <!-- Identity Card -->
  <div class="pf-card">
    <div class="pf-card-glow" aria-hidden="true"></div>
    {#if profilePic}
      <img src={profilePic} alt="" class="pf-pic" referrerpolicy="no-referrer" />
    {:else}
      <div class="pf-pic-fallback">{displayName[0]?.toUpperCase()}</div>
    {/if}
    <h1 class="pf-name">{displayName}</h1>
    {#if city}<p class="pf-city">{city}</p>{/if}
    {#if aesthetic}<p class="pf-aesthetic">{aesthetic}</p>{/if}

    {#if personalTags.length > 0}
      <div class="pf-tags">
        {#each personalTags as tag}
          <span class="pf-tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  {#if graphStrengthLoading && !graphStrength}
    <p class="pf-graph-loading">Loading signal strength…</p>
  {:else if graphStrength}
    <section class="pf-section pf-graph-strength">
      <div class="pf-signals-hd">
        <h2 class="pf-label">
          Match signal strength <span class="pf-label-count">{graphStrength.label}</span>
        </h2>
        <span class="pf-synced"
          >{graphStrength.score}/100 · {graphStrength.source_count} sources · data {graphStrength.freshness_bucket}</span
        >
      </div>
      <p class="pf-graph-copy">
        Brands search using your identity graph. More connected accounts and fresher sync usually mean better,
        more relevant matches. We summarize connected accounts into tags; brands do not receive raw inbox, DMs,
        or full OAuth payloads. Edit manual interests on Earn. Disconnect any link here anytime.
      </p>
      <div class="pf-strength-bar" aria-hidden="true">
        <div class="pf-strength-fill" style="width: {Math.min(100, graphStrength.score)}%"></div>
      </div>
      <p class="pf-graph-meta">{graphStrength.tag_count} signal tags indexed</p>
    </section>
  {/if}

  <!-- Live Signal Tiles -->
  <section class="pf-section">
    <div class="pf-signals-hd">
      <h2 class="pf-label">Signals <span class="pf-label-count">{connectedCount} connected</span></h2>
      {#if $profile.profileUpdatedAt}
        <span class="pf-synced">↻ {relativeTime($profile.profileUpdatedAt)}</span>
      {/if}
    </div>

    {#if connectedCount > 0}
      <div class="pf-signal-tiles">

        <!-- LinkedIn -->
        {#if $profile.linkedinConnected}
          {@const li = $profile.linkedinIdentity}
          <div class="pf-tile">
            <div class="pf-tile-hd">
              <span class="pf-tile-icon">💼</span>
              <span class="pf-tile-name">LinkedIn</span>
              <span class="pf-tile-dot"></span>
            </div>
            {#if li?.currentRole || li?.headline}
              <p class="pf-tile-lead">{li.currentRole || li.headline}</p>
              {#if li.currentCompany}<p class="pf-tile-sub">at {li.currentCompany}</p>{/if}
              <div class="pf-tile-chips">
                {#if li.seniority}<span class="pf-chip pf-chip--pro">{li.seniority}</span>{/if}
                {#each li.skills.slice(0, 2) as sk}<span class="pf-chip">{sk}</span>{/each}
                {#each (li.professionalThemeTags ?? []).slice(0, 3) as tg}<span class="pf-chip">{tg.replace(/_/g, ' ')}</span>{/each}
              </div>
              {#if li.careerSummary}
                <p class="pf-tile-quote">"{li.careerSummary.slice(0, 68)}{li.careerSummary.length > 68 ? '…' : ''}"</p>
              {/if}
            {:else}
              <p class="pf-tile-sub pf-tile-empty">Identity syncing…</p>
            {/if}
            <button class="pf-tile-disc" on:click={() => profile.update(p => ({ ...p, linkedinConnected: false, linkedinIdentity: null }))}>Disconnect</button>
          </div>
        {/if}

        <!-- Instagram -->
        {#if $profile.instagramConnected}
          {@const ig = $profile.instagramIdentity}
          <div class="pf-tile">
            <div class="pf-tile-hd">
              <span class="pf-tile-icon">📸</span>
              <span class="pf-tile-name">Instagram</span>
              <span class="pf-tile-dot"></span>
            </div>
            {#if ig?.aesthetic || ig?.interests?.length}
              {#if ig.aesthetic}<p class="pf-tile-lead">{ig.aesthetic}</p>{/if}
              {#if ig.followersCount != null}
                <p class="pf-tile-sub">{ig.followersCount.toLocaleString()} followers{ig.mediaCount != null ? ` · ${ig.mediaCount} posts` : ''}</p>
              {/if}
              <div class="pf-tile-chips">
                {#each (ig.interests ?? []).slice(0, 3) as t}<span class="pf-chip">{t}</span>{/each}
              </div>
              {#if ig.topHashtags?.length}
                <p class="pf-tile-quote">"{ig.topHashtags.slice(0, 3).map(h => `#${h.replace(/^#/, '')}`).join(' ')}"</p>
              {/if}
            {:else}
              <p class="pf-tile-sub pf-tile-empty">Identity syncing…</p>
            {/if}
            <button class="pf-tile-disc" on:click={() => profile.update(p => ({ ...p, instagramConnected: false, instagramIdentity: null }))}>Disconnect</button>
          </div>
        {/if}

        <!-- Apple Music -->
        {#if $profile.appleMusicConnected}
          {@const am = $profile.appleMusicIdentity}
          <div class="pf-tile pf-tile--music">
            <div class="pf-tile-hd">
              <span class="pf-tile-icon">🎧</span>
              <span class="pf-tile-name">Apple Music</span>
              <span class="pf-tile-dot"></span>
            </div>
            {#if am}
              {#if am.topArtists?.length}
                <div class="pf-tile-art-row">
                  {#each am.topArtists.slice(0, 3) as artist}
                    {#if itunesArtwork[artist]}
                      <img src={itunesArtwork[artist]} alt={artist} class="pf-tile-art" title={artist} />
                    {:else}
                      <div class="pf-tile-art pf-tile-art--ph">{artist[0]?.toUpperCase()}</div>
                    {/if}
                  {/each}
                </div>
              {/if}
              {#if am.vibeDescription}<p class="pf-tile-lead">{am.vibeDescription}</p>{/if}
              <div class="pf-tile-chips">
                {#each (am.topGenres ?? []).slice(0, 3) as g}<span class="pf-chip">{g}</span>{/each}
              </div>
              {#if am.musicPersonality}
                <p class="pf-tile-quote">"{am.musicPersonality.slice(0, 68)}{am.musicPersonality.length > 68 ? '…' : ''}"</p>
              {/if}
            {:else}
              <p class="pf-tile-sub pf-tile-empty">Identity syncing…</p>
            {/if}
            <button
              class="pf-tile-disc"
              on:click={async () => {
                const sub = $profile.googleSub;
                profile.update(p => ({ ...p, appleMusicConnected: false, appleMusicIdentity: null }));
                if (sub) await syncProfileToSupabase(get(profile), { appleMusicUserToken: '' });
              }}>Disconnect</button>
          </div>
        {/if}

        <!-- Spotify -->
        {#if $profile.spotifyConnected}
          {@const sp = $profile.spotifyIdentity}
          <div class="pf-tile pf-tile--music">
            <div class="pf-tile-hd">
              <span class="pf-tile-icon">🎵</span>
              <span class="pf-tile-name">Spotify</span>
              <span class="pf-tile-dot"></span>
            </div>
            {#if sp}
              {#if sp.topArtists?.length}
                <div class="pf-tile-art-row">
                  {#each sp.topArtists.slice(0, 3) as artist}
                    {#if itunesArtwork[artist]}
                      <img src={itunesArtwork[artist]} alt={artist} class="pf-tile-art" title={artist} />
                    {:else}
                      <div class="pf-tile-art pf-tile-art--ph">{artist[0]?.toUpperCase()}</div>
                    {/if}
                  {/each}
                </div>
              {/if}
              {#if sp.vibeDescription}<p class="pf-tile-lead">{sp.vibeDescription}</p>{/if}
              <div class="pf-tile-chips">
                {#each (sp.topGenres ?? []).slice(0, 3) as g}<span class="pf-chip">{g}</span>{/each}
                {#each (sp.musicDescriptorTags ?? []).slice(0, 3) as g}<span class="pf-chip">{g}</span>{/each}
              </div>
              {#if sp.musicPersonality}
                <p class="pf-tile-quote">"{sp.musicPersonality.slice(0, 68)}{sp.musicPersonality.length > 68 ? '…' : ''}"</p>
              {/if}
            {:else}
              <p class="pf-tile-sub pf-tile-empty">Identity syncing…</p>
            {/if}
            <button class="pf-tile-disc" on:click={() => profile.update(p => ({ ...p, spotifyConnected: false, spotifyIdentity: null }))}>Disconnect</button>
          </div>
        {/if}

        <!-- Google -->
        {#if $profile.googleConnected}
          {@const gi = $profile.googleIdentity}
          <div class="pf-tile">
            <div class="pf-tile-hd">
              <span class="pf-tile-icon">🔵</span>
              <span class="pf-tile-name">Google</span>
              <span class="pf-tile-dot"></span>
            </div>
            {#if $twinUiContext.nextEvent}
              <p class="pf-tile-lead">{$twinUiContext.nextEvent.title}</p>
              <p class="pf-tile-sub">{$twinUiContext.minutesUntilNext != null && $twinUiContext.minutesUntilNext < 120 ? `in ${$twinUiContext.minutesUntilNext}m` : 'upcoming'}</p>
            {:else if gi?.contentPersonality}
              <p class="pf-tile-lead">{gi.contentPersonality.slice(0, 52)}</p>
            {:else}
              <p class="pf-tile-sub pf-tile-empty">Calendar & inbox live</p>
            {/if}
            <div class="pf-tile-chips">
              {#each (gi?.twin?.lifestyle?.dominantCalendarTypes ?? []).slice(0, 3) as t}
                <span class="pf-chip">{t.replace(/_/g, ' ')}</span>
              {/each}
            </div>
            {#if gi?.emailThemes?.[0]}
              <p class="pf-tile-quote">"{gi.emailThemes[0].slice(0, 60)}{gi.emailThemes[0].length > 60 ? '…' : ''}"</p>
            {/if}
            <button class="pf-tile-disc" on:click={() => profile.update(p => ({ ...p, googleConnected: false, googleIdentity: null, googleAccessToken: '', googleRefreshToken: '' }))}>Disconnect</button>
          </div>
        {/if}

        <!-- YouTube (standalone) -->
        {#if $profile.youtubeConnected && !$profile.googleConnected}
          {@const yt = $profile.youtubeIdentity}
          <div class="pf-tile">
            <div class="pf-tile-hd">
              <span class="pf-tile-icon">📺</span>
              <span class="pf-tile-name">YouTube</span>
              <span class="pf-tile-dot"></span>
            </div>
            {#if yt?.contentPersonality}
              <p class="pf-tile-lead">{yt.contentPersonality.slice(0, 52)}</p>
              <div class="pf-tile-chips">
                {#each (yt.topCategories ?? []).slice(0, 3) as c}<span class="pf-chip">{c}</span>{/each}
              </div>
            {:else}
              <p class="pf-tile-sub pf-tile-empty">Library synced</p>
            {/if}
            <button class="pf-tile-disc" on:click={() => profile.update(p => ({ ...p, youtubeConnected: false, youtubeIdentity: null }))}>Disconnect</button>
          </div>
        {/if}

      </div>
    {/if}

    <!-- Add more signals -->
    {#if platforms.filter(pl => !pl.connected).length > 0}
      <div class="pf-add-signals">
        <span class="pf-add-label">Add signals</span>
        {#each platforms.filter(pl => !pl.connected) as pl}
          <button type="button" class="pf-add-chip" on:click={() => pl.connect()}>{pl.icon} {pl.name}</button>
        {/each}
      </div>
    {/if}

    {#if connectedCount > 0 && $profile.googleSub}
      <button class="pf-refresh-btn" on:click={refreshSignals} disabled={refreshing}>
        <span class="pf-refresh-icon" class:spinning={refreshing}><ArrowClockwise size={14} /></span>
        {refreshing ? 'Analyzing signals…' : 'Refresh signals'}
      </button>
      {#if refreshResult}
        <div class="pf-refresh-result">
          {#if refreshResult.expired.length > 0}
            <p class="pf-refresh-warn">Tokens expired for: {refreshResult.expired.join(', ')}. Reconnect to refresh.</p>
          {:else}
            <p class="pf-refresh-ok">Signals updated successfully.</p>
          {/if}
        </div>
      {/if}
      {#if refreshError}<p class="pf-refresh-warn">{refreshError}</p>{/if}
    {/if}
  </section>

  {#if $profile.appleMusicConnected && $profile.appleMusicIdentity}
    {@const am = $profile.appleMusicIdentity}
    {@const hasAmExtras =
      (am.latestReleases?.length ?? 0) > 0 ||
      (am.rotationPlaylists?.length ?? 0) > 0 ||
      (am.libraryPlaylists?.length ?? 0) > 0 ||
      (am.topArtists?.length ?? 0) ||
      (am.heavyRotationTracks?.length ?? 0) > 0 ||
      (am.recentlyPlayed?.length ?? 0) > 0}
    {#if hasAmExtras || am.vibeDescription || am.musicPersonality}
      <section class="pf-section pf-am">
        <h2 class="pf-label">Apple Music</h2>
        <p class="pf-desc">From your heavy rotation and library. Reconnect Apple Music anytime to refresh.</p>
        {#if am.vibeDescription}
          <span class="pf-am-vibe-chip">{am.vibeDescription}</span>
        {/if}
        {#if am.musicPersonality}
          <p class="pf-am-personality">{am.musicPersonality}</p>
        {/if}

        {#if am.topArtists?.length}
          <p class="pf-am-sub">Artists on repeat</p>
          <div class="pf-tags pf-am-tags">
            {#each am.topArtists.slice(0, 8) as a}
              <span class="pf-tag">{a}</span>
            {/each}
          </div>
        {/if}

        {#if am.heavyRotationTracks?.length}
          <p class="pf-am-sub">Heavy rotation (tracks & albums)</p>
          <ul class="pf-am-list">
            {#each am.heavyRotationTracks.slice(0, 8) as tr}
              <li>{tr.artistName ? `${tr.title} — ${tr.artistName}` : tr.title}</li>
            {/each}
          </ul>
        {/if}

        {#if am.recentlyPlayed?.length}
          <p class="pf-am-sub">Recently played</p>
          <ul class="pf-am-list">
            {#each am.recentlyPlayed.slice(0, 8) as tr}
              <li>{tr.artistName ? `${tr.title} — ${tr.artistName}` : tr.title}</li>
            {/each}
          </ul>
        {/if}

        {#if am.latestReleases?.length}
          <p class="pf-am-sub">New from artists you play</p>
          <div class="pf-facts">
            {#each am.latestReleases.slice(0, 5) as r}
              <div class="pf-fact pf-am-drop">
                <span class="pf-am-drop-title">{r.title}</span>
                <span class="pf-am-drop-meta">{r.artistName}{#if r.releaseDate} · {r.releaseDate}{/if}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if am.rotationPlaylists?.length}
          <p class="pf-am-sub">Playlists in rotation</p>
          <ul class="pf-am-list">
            {#each am.rotationPlaylists.slice(0, 6) as p}
              <li>{p}</li>
            {/each}
          </ul>
        {/if}

        {#if am.libraryPlaylists?.length}
          <p class="pf-am-sub">From your library</p>
          <div class="pf-am-playlist-row">
            {#each am.libraryPlaylists.slice(0, 8) as p}
              <span class="pf-am-pl">{p}</span>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  {/if}

  {#if $profile.googleConnected && googleTwinInsights.length > 0}
    <section class="pf-section">
      <h2 class="pf-label">Your twin notices</h2>
      <p class="pf-desc">Patterns from your schedule and activity — reconnect Google after a while to refresh.</p>
      <div class="pf-facts">
        {#each googleTwinInsights as line (line)}
          <div class="pf-fact">{line}</div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Twin Knowledge -->
  {#if learnedFacts.length > 0}
    <section class="pf-section">
      <h2 class="pf-label">Your twin knows</h2>
      <div class="pf-facts">
        {#each learnedFacts as fact}
          <div class="pf-fact">{fact}</div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Settings -->
  <section class="pf-section">
    <h2 class="pf-label">Settings</h2>
    <p class="pf-desc">Twin chats and learned facts are saved on this device.</p>
    <div class="pf-actions">
      <button class="pf-btn" on:click={clearTwinMemory}>Clear memory</button>
      <button class="pf-btn" on:click={exportTwinMemory}>Export</button>
    </div>
  </section>

  <button class="pf-reset" on:click={resetApp}>Reset & start over</button>
  <div class="pf-nav-spacer" aria-hidden="true"></div>

  {#if refreshing}
    <div
      class="pf-analyse-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="pf-analyse-card">
        <span class="pf-analyse-icon spinning" aria-hidden="true"><ArrowClockwise size={28} /></span>
        <p class="pf-analyse-title">Analysing your profile</p>
        <p class="pf-analyse-sub">Pulling fresh signals from connected accounts. This can take a little while.</p>
      </div>
    </div>
  {/if}
  </div>
</div>

<style>
  .profile-page-root {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: transparent;
    overflow-x: hidden;
  }

  .profile-aurora {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 70% 50% at 80% -10%, rgba(196, 242, 74, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse 55% 40% at 10% 90%, rgba(59, 130, 246, 0.06) 0%, transparent 48%);
    mix-blend-mode: screen;
    opacity: 0.65;
  }

  .profile-page-root > .pf {
    position: relative;
    z-index: 1;
  }

  .pf {
    width: 100%;
    padding: max(40px, env(safe-area-inset-top)) clamp(14px, 2.2vw, 28px)
      max(100px, calc(env(safe-area-inset-bottom) + 72px));
    min-height: 0;
  }

  @media (min-width: 768px) {
    .pf {
      max-width: none;
      margin-left: 0;
      margin-right: 0;
      padding-left: max(24px, env(safe-area-inset-left));
      padding-right: max(24px, env(safe-area-inset-right));
    }
  }

  @media (min-width: 1024px) {
    .pf {
      max-width: none;
      padding-left: clamp(16px, 2vw, 28px);
      padding-right: clamp(16px, 2vw, 28px);
    }
  }

  /* Identity Card — align with Home glass modules */
  .pf-card {
    position: relative;
    background: color-mix(in srgb, var(--glass-light) 92%, transparent);
    border: 1px solid var(--panel-border);
    border-radius: 20px;
    padding: 32px 24px;
    text-align: center;
    backdrop-filter: blur(18px) saturate(1.06);
    -webkit-backdrop-filter: blur(18px) saturate(1.06);
    box-shadow: var(--shadow-tall-card);
    overflow: hidden;
    margin-bottom: 22px;
  }
  .pf-card-glow {
    position: absolute;
    width: 200px; height: 200px;
    top: -60px; left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent-glow), transparent 70%);
    filter: blur(40px);
    pointer-events: none;
  }
  .pf-pic {
    width: 80px; height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin: 0 auto 14px;
    display: block;
    border: 3px solid var(--accent-soft);
    position: relative;
  }
  .pf-pic-fallback {
    width: 80px; height: 80px;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--accent-primary), var(--accent-secondary));
    display: flex; align-items: center; justify-content: center;
    font-size: 30px; font-weight: 700; color: white;
    margin: 0 auto 14px;
    position: relative;
  }
  .pf-name {
    margin: 0;
    font-size: 22px; font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    position: relative;
  }
  .pf-city {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
    position: relative;
  }
  .pf-aesthetic {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--text-secondary);
    font-style: italic;
    position: relative;
  }
  .pf-tags {
    display: flex; flex-wrap: wrap; gap: 6px;
    justify-content: center;
    margin-top: 16px;
    position: relative;
  }
  .pf-tag {
    font-size: 12px;
    padding: 5px 12px;
    border-radius: 100px;
    background: var(--accent-soft);
    color: var(--accent-primary);
    border: 1px solid var(--accent-glow);
  }

  /* Sections — glass shells like Home */
  .pf-section {
    margin-bottom: 18px;
    padding: 16px 18px 18px;
    border-radius: 20px;
    border: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    box-shadow: var(--shadow-tall-card);
    backdrop-filter: blur(14px) saturate(1.05);
    -webkit-backdrop-filter: blur(14px) saturate(1.05);
  }

  .pf-label {
    margin: 0 0 12px;
    font-size: var(--home-font-section, 14px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pf-label-count {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: none;
    color: var(--text-muted);
    background: var(--glass-light);
    padding: 2px 8px;
    border-radius: 100px;
  }
  .pf-desc {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Signal tile header ── */
  .pf-signals-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .pf-signals-hd .pf-label { margin-bottom: 0; }
  .pf-synced {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  /* ── Signal tiles row ── */
  .pf-signal-tiles {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 12px;
  }
  .pf-signal-tiles::-webkit-scrollbar { display: none; }

  @media (min-width: 1024px) {
    .pf-signal-tiles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      overflow-x: visible;
    }
  }

  /* ── Individual tile ── */
  .pf-tile {
    flex-shrink: 0;
    width: 168px;
    min-height: 180px;
    padding: 12px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
    backdrop-filter: blur(12px) saturate(1.04);
    -webkit-backdrop-filter: blur(12px) saturate(1.04);
    border: 1px solid var(--panel-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease;
  }

  .pf-tile:hover {
    border-color: color-mix(in srgb, var(--panel-border-strong) 70%, var(--panel-border));
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  }

  @media (min-width: 1024px) {
    .pf-tile { width: auto; min-height: 190px; }
  }

  .pf-tile--music {
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--glass-light) 90%, transparent),
      color-mix(in srgb, var(--accent-soft) 45%, transparent)
    );
  }

  .pf-tile-hd {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 2px;
  }
  .pf-tile-icon { font-size: 13px; line-height: 1; }
  .pf-tile-name {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
    flex: 1;
  }
  .pf-tile-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--state-success);
    flex-shrink: 0;
  }

  .pf-tile-lead {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
    letter-spacing: -0.01em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pf-tile-sub {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .pf-tile-empty { font-style: italic; }

  .pf-tile-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }
  .pf-chip {
    font-size: 10px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 100px;
    background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
    border: 1px solid var(--panel-border);
    color: var(--text-secondary);
    white-space: nowrap;
  }
  .pf-chip--pro {
    background: var(--accent-soft);
    border-color: var(--accent-glow);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .pf-tile-quote {
    margin: 2px 0 0;
    font-size: 10px;
    font-style: italic;
    color: var(--text-muted);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
  }

  /* Cover art strip */
  .pf-tile-art-row {
    display: flex;
    gap: 4px;
    margin-bottom: 2px;
  }
  .pf-tile-art {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .pf-tile-art--ph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-muted);
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
  }

  .pf-tile-disc {
    margin-top: auto;
    padding: 0;
    font-size: 10px;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    opacity: 0.5;
    transition: opacity 0.15s;
  }
  .pf-tile-disc:hover { opacity: 1; color: var(--state-error); }

  /* Add signals row */
  .pf-add-signals {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
  }
  .pf-add-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-right: 2px;
  }
  .pf-add-chip {
    font-size: 11px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 100px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .pf-add-chip:hover {
    background: var(--glass-medium);
    border-color: var(--border-strong);
  }

  /* Refresh button */
  .pf-refresh-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--accent-primary);
    background: var(--accent-soft);
    border: 1px solid var(--accent-glow);
    border-radius: 100px;
    cursor: pointer;
    transition: opacity 0.2s, background 0.2s;
    width: 100%;
    justify-content: center;
  }
  .pf-refresh-btn:hover:not(:disabled) {
    background: var(--glass-medium);
  }
  .pf-refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .pf-refresh-icon {
    display: flex;
    align-items: center;
  }
  .pf-refresh-icon.spinning {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .pf-analyse-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--text-primary) 18%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: max(24px, env(safe-area-inset-top)) 24px max(32px, env(safe-area-inset-bottom));
  }
  .pf-analyse-card {
    max-width: 20rem;
    text-align: center;
    padding: 28px 24px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--glass-light) 94%, transparent);
    border: 1px solid var(--panel-border);
    box-shadow: var(--shadow-tall-card);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .pf-analyse-icon {
    display: inline-flex;
    margin-bottom: 14px;
    color: var(--accent-primary);
  }
  .pf-analyse-icon.spinning {
    animation: spin 1s linear infinite;
  }
  .pf-analyse-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .pf-analyse-sub {
    margin: 10px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }
  .pf-refresh-result {
    margin-top: 8px;
  }
  .pf-refresh-ok {
    font-size: 12px;
    color: var(--state-success);
    margin: 0;
  }
  .pf-connect-error {
    margin-bottom: 16px;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--state-error);
    background: color-mix(in srgb, var(--state-error) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--state-error) 22%, transparent);
    border-radius: 12px;
  }

  .pf-refresh-warn {
    font-size: 12px;
    color: var(--state-warning);
    margin: 4px 0 0;
  }

  .pf-graph-loading {
    font-size: 13px;
    color: var(--text-muted);
    margin: 12px 0;
    padding: 0 4px;
  }
  .pf-graph-copy {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 8px 0 10px;
  }
  .pf-strength-bar {
    height: 8px;
    border-radius: 999px;
    background: var(--panel-divider);
    overflow: hidden;
    border: 1px solid var(--panel-border);
  }
  .pf-strength-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-primary), #059669);
    transition: width 0.35s ease;
  }
  .pf-graph-meta {
    font-size: 12px;
    color: var(--text-muted);
    margin: 8px 0 0;
  }

  /* Apple Music snapshot */
  .pf-am-vibe-chip {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 100px;
    background: var(--accent-soft);
    color: var(--accent-primary);
    border: 1px solid var(--accent-glow);
    margin-bottom: 10px;
  }
  .pf-am-personality {
    margin: 0 0 4px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .pf-am-tags {
    justify-content: flex-start;
    margin-top: 0;
  }
  .pf-am-sub {
    margin: 14px 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .pf-am-sub:first-of-type {
    margin-top: 10px;
  }
  .pf-am-drop {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pf-am-drop-title {
    font-weight: 600;
    color: var(--text-primary);
  }
  .pf-am-drop-meta {
    font-size: 12px;
    color: var(--text-muted);
  }
  .pf-am-list {
    margin: 0;
    padding-left: 1.15rem;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.55;
  }
  .pf-am-playlist-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pf-am-pl {
    font-size: 12px;
    padding: 6px 11px;
    border-radius: 10px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
  }

  /* Learned facts */
  .pf-facts {
    display: flex; flex-direction: column; gap: 6px;
  }
  .pf-fact {
    padding: 10px 14px;
    background: color-mix(in srgb, var(--bg-elevated) 75%, transparent);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  /* Actions */
  .pf-actions {
    display: flex; gap: 10px;
  }
  .pf-btn {
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--glass-light) 85%, transparent);
    border: 1px solid var(--panel-border);
    border-radius: 100px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }
  .pf-btn:hover {
    background: var(--panel-hover);
    color: var(--text-primary);
    border-color: color-mix(in srgb, var(--panel-border-strong) 55%, var(--panel-border));
  }

  /* Reset — secondary destructive, not loud marketing red */
  .pf-reset {
    width: 100%;
    padding: 12px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    border: 1px dashed var(--panel-border-strong);
    border-radius: 14px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }
  .pf-reset:hover {
    color: var(--state-error);
    background: color-mix(in srgb, var(--state-error) 8%, transparent);
    border-color: color-mix(in srgb, var(--state-error) 35%, transparent);
  }

  .pf-nav-spacer {
    height: calc(100px + env(safe-area-inset-bottom, 0px));
  }
  @media (min-width: 1024px) {
    .pf-nav-spacer {
      height: max(28px, env(safe-area-inset-bottom, 0px));
    }
  }
</style>
