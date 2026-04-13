<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { profile } from '$lib/stores/profile';
  import type { ResultCard as Card } from '$lib/utils';
  import type { CalendarEvent } from '$lib/server/google';
  import { buildTwinStarters } from '$lib/prompts/twinStarters';
  import { suggestionHeroUrl } from '$lib/suggestionImagery';
  import {
    updateFeed, getFeed,
    getCachedLocal as getCached,
    setCachedLocal as setCache,
    getGoogleCachedLocal as getGoogleCached,
    setGoogleCachedLocal as setGoogleCache,
  } from '$lib/stores/feedCache';
  import {
    twinUiContext,
    updateTwinContextFromCalendar,
    startTwinContextClock,
    type TwinUiContext,
  } from '$lib/stores/contextStore';
  import { buildExploreContextTags } from '$lib/utils/googleInsightMapper';
  import { ensureMatchReasons } from '$lib/utils/matchReason';
  import type { GoogleTwin } from '$lib/utils';
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { visualAssets } from '$lib/theme/visualAssets';
  import type { AppleMusicExplorePick } from '$lib/utils';
  import { playAppleMusicTrack } from '$lib/client/appleMusicPlayback';

  let recsLoading = true;
  let recsError = false;
  let recs: Card[] = [];

  let calLoading = false;
  let calError = false;
  let calEvents: CalendarEvent[] = [];

  let gmailLoading = false;
  let gmailError = false;
  let gmailBullets: string[] = [];

  let appleExploreLoading = false;
  let appleExploreError = false;
  let appleExploreSongs: AppleMusicExplorePick[] = [];
  let appleExploreStorefront = 'us';
  let appleExploreBusyId: string | null = null;

  $: ig = $profile.instagramIdentity;
  $: city = $profile.city || ig?.city || '';
  $: displayName = ig?.displayName?.split(' ')[0] || $profile.name?.split(' ')[0] || '';
  $: profilePic = ig?.profilePicture || '';
  $: aesthetic = ig?.aesthetic || '';
  $: musicVibe = ig?.musicVibe || '';
  $: foodVibe = ig?.foodVibe || '';
  $: travelStyle = ig?.travelStyle || '';

  $: personalTags = (() => {
    const tags: string[] = [];
    if (ig?.interests?.length) tags.push(...ig.interests.slice(0, 4));
    else if ($profile.interests?.length) tags.push(...$profile.interests.slice(0, 4));
    if (ig?.brandVibes?.length) tags.push(...ig.brandVibes.slice(0, 2));
    return [...new Set(tags)].slice(0, 6);
  })();

  $: askTags = (() => {
    const base = [
      { label: 'Summarise my day', query: 'Summarise what matters for me today' },
      { label: 'Inbox priorities', query: 'What needs attention in my inbox right now' },
      { label: 'Plan my weekend', query: 'Plan my weekend based on what I like' },
    ];
    const fromStarters = buildTwinStarters(city || 'my city', $profile)
      .slice(0, 5)
      .map(x => ({ label: x.label, query: x.query }));
    const seen = new Set<string>();
    const out: { label: string; query: string }[] = [];
    for (const t of [...base, ...fromStarters]) {
      const k = t.label.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= 8) break;
    }
    return out;
  })();

  async function loadRecs() {
    const mem = getFeed();
    if (mem.recs.length) { recs = mem.recs; recsLoading = false; return; }
    const cached = getCached<{ message: string; cards: Card[] }>('home_recs');
    if (cached?.cards?.length) { recs = cached.cards; updateFeed({ recs: cached.cards }); recsLoading = false; return; }
    recsLoading = true; recsError = false;
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: $profile, googleSub: $profile.googleSub }),
      });
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { message?: string; cards?: Card[] };
      recs = data.cards ?? [];
      if (recs.length) { setCache('home_recs', data); updateFeed({ recs }); }
    } catch { recsError = true; }
    finally { recsLoading = false; }
  }

  async function loadCalendar() {
    const mem = getFeed();
    if (mem.calendar.length) {
      calEvents = mem.calendar;
      updateTwinContextFromCalendar(calEvents);
      calLoading = false;
      return;
    }
    const cached = getGoogleCached<CalendarEvent[]>('cal');
    if (cached?.length) {
      calEvents = cached;
      updateTwinContextFromCalendar(calEvents);
      updateFeed({ calendar: cached });
      calLoading = false;
      return;
    }
    calLoading = true; calError = false;
    try {
      let token = $profile.googleAccessToken;
      if (!token && $profile.googleRefreshToken) {
        const rr = await fetch('/api/google/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: $profile.googleRefreshToken }),
        });
        if (rr.ok) { const { accessToken } = await rr.json(); token = accessToken; profile.update(p => ({ ...p, googleAccessToken: accessToken })); }
      }
      if (!token) { calError = true; calLoading = false; return; }
      let res = await fetch('/api/google/calendar', { headers: { 'x-google-token': token } });
      if (res.status === 401 && $profile.googleRefreshToken) {
        const rr = await fetch('/api/google/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: $profile.googleRefreshToken }) });
        if (rr.ok) { const { accessToken } = await rr.json(); token = accessToken; profile.update(p => ({ ...p, googleAccessToken: accessToken })); res = await fetch('/api/google/calendar', { headers: { 'x-google-token': token } }); }
      }
      const data = await res.json();
      calEvents = data.events ?? [];
      updateTwinContextFromCalendar(calEvents);
      if (calEvents.length) { setGoogleCache('cal', calEvents); updateFeed({ calendar: calEvents }); }
    } catch { calError = true; }
    finally { calLoading = false; }
  }

  async function loadGmail() {
    const mem = getFeed();
    if (mem.gmail.length) { gmailBullets = mem.gmail; gmailLoading = false; return; }
    const cached = getGoogleCached<string[]>('gmail');
    if (cached) { gmailBullets = cached; updateFeed({ gmail: cached }); gmailLoading = false; return; }
    gmailLoading = true; gmailError = false;
    try {
      const res = await fetch('/api/google/gmail', { headers: { 'x-google-token': $profile.googleAccessToken } });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      gmailBullets = data.bullets ?? [];
      if (gmailBullets.length) { setGoogleCache('gmail', gmailBullets); updateFeed({ gmail: gmailBullets }); }
    } catch { gmailError = true; }
    finally { gmailLoading = false; }
  }

  function fmtTime(e: CalendarEvent): string {
    if (e.allDay) return 'All day';
    return new Date(e.start).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  }

  $: upcoming = [...calEvents]
    .filter(e => new Date(e.start).getTime() >= Date.now() - 60 * 60 * 1000)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4);

  function scoreRecForContext(card: Card, ctx: TwinUiContext, twin: GoogleTwin | null | undefined): number {
    let s = card.match_score ?? 70;
    const next = ctx.nextEvent;
    if (next?.title) {
      const title = next.title.toLowerCase();
      if (/dinner|lunch|food|coffee|brunch|cafe/.test(title) && card.category === 'food') s += 14;
      if (/flight|trip|travel|hotel/.test(title) && card.category === 'travel') s += 14;
      if (/gym|workout|run|yoga|fitness/.test(title) && card.category === 'fitness') s += 14;
      if (ctx.minutesUntilNext != null && ctx.minutesUntilNext < 90 && ['food', 'nightlife'].includes(card.category)) {
        s += 10;
      }
    }
    if (twin?.lifestyle?.dominantCalendarTypes?.includes('food_social') && card.category === 'food') s += 6;
    if (twin?.lifestyle?.dominantCalendarTypes?.includes('travel') && card.category === 'travel') s += 6;
    return s;
  }

  $: exploreContextTags = buildExploreContextTags($profile.googleIdentity?.twin, $twinUiContext);
  $: recsRanked = [...recs].sort(
    (a, b) =>
      scoreRecForContext(b, $twinUiContext, $profile.googleIdentity?.twin) -
      scoreRecForContext(a, $twinUiContext, $profile.googleIdentity?.twin),
  );
  $: recsDisplayedExplore = ensureMatchReasons(recsRanked, $profile.googleIdentity?.twin, $twinUiContext);
  $: topRecs = recsDisplayedExplore.slice(0, 4);
  $: inboxLines = gmailBullets.slice(0, 3);

  function ask(q: string) { goto(`/ai?q=${encodeURIComponent(q)}`); }

  async function loadAppleExplore() {
    if (!$profile.setupComplete) return;
    appleExploreLoading = true;
    appleExploreError = false;
    try {
      const res = await fetch('/api/applemusic/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: $profile }),
      });
      if (res.status === 503) {
        appleExploreSongs = [];
        return;
      }
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { songs?: AppleMusicExplorePick[]; storefront?: string };
      appleExploreSongs = data.songs ?? [];
      if (data.storefront) appleExploreStorefront = data.storefront;
    } catch {
      appleExploreError = true;
    } finally {
      appleExploreLoading = false;
    }
  }

  async function playExplorePick(pick: AppleMusicExplorePick) {
    const k = pick.appleMusicId ?? pick.title;
    if (appleExploreBusyId === k) return;
    appleExploreBusyId = k;
    try {
      await playAppleMusicTrack(pick, appleExploreStorefront);
    } finally {
      appleExploreBusyId = null;
    }
  }

  onMount(() => {
    if (!$profile.setupComplete) { recsLoading = false; return; }
    loadRecs();
    loadAppleExplore();
    if ($profile.googleConnected) {
      loadCalendar();
      loadGmail();
      startTwinContextClock();
    } else {
      calLoading = false;
      gmailLoading = false;
    }
  });
</script>

<div class="ex">
  <!-- Identity hero -->
  <header class="ex-hero">
    {#if profilePic}
      <img src={profilePic} alt="" class="ex-avatar" referrerpolicy="no-referrer" />
    {:else}
      <div class="ex-avatar ex-avatar--fallback" aria-hidden="true">
        {(displayName || '?')[0].toUpperCase()}
      </div>
    {/if}

    <div class="ex-hero-text">
      <h1 class="ex-name">{displayName ? `${displayName}'s` : 'Your'} space</h1>
      {#if aesthetic}
        <p class="ex-aesthetic">{aesthetic}</p>
      {/if}
    </div>

    {#if personalTags.length}
      <div class="ex-identity-tags">
        {#each personalTags as tag (tag)}
          <span class="ex-id-tag">{tag}</span>
        {/each}
      </div>
    {/if}
    {#if $profile.googleConnected && exploreContextTags.length}
      <div class="ex-context-tags" aria-label="Context">
        {#each exploreContextTags as tag (tag)}
          <span class="ex-ctx-tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </header>

  <!-- Vibes strip -->
  {#if musicVibe || foodVibe || travelStyle}
    <div class="ex-vibes">
      {#if musicVibe}<div class="ex-vibe-card"><span class="ex-vibe-label">Music</span><span class="ex-vibe-val">{musicVibe}</span></div>{/if}
      {#if foodVibe}<div class="ex-vibe-card"><span class="ex-vibe-label">Food</span><span class="ex-vibe-val">{foodVibe}</span></div>{/if}
      {#if travelStyle}<div class="ex-vibe-card"><span class="ex-vibe-label">Travel</span><span class="ex-vibe-val">{travelStyle}</span></div>{/if}
    </div>
  {/if}

  <!-- Apple Music discovery (catalog suggestions — different from home rotation) -->
  {#if $profile.setupComplete && (appleExploreLoading || appleExploreError || appleExploreSongs.length)}
    <section class="ex-section">
      <SectionHeader title="Music to explore" />
      {#if appleExploreLoading}
        <div class="ex-am-skel-row" aria-hidden="true">
          {#each [1, 2, 3] as _}
            <div class="ex-am-skel-card"></div>
          {/each}
        </div>
      {:else if appleExploreError}
        <p class="ex-muted">Couldn’t load music suggestions.</p>
      {:else}
        <p class="ex-am-intro">
          Beyond your usual rotation — discovery picks from your Apple, Spotify, and Instagram signals. Tap Play to open in Apple Music.
        </p>
        <div class="ex-am-scroll">
          {#each appleExploreSongs as pick (pick.appleMusicId ?? pick.title + pick.reason)}
            <article class="ex-am-card">
              {#if pick.artworkUrl}
                <img
                  src={pick.artworkUrl}
                  alt=""
                  class="ex-am-art"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
              {:else}
                <div class="ex-am-art ex-am-art--ph" aria-hidden="true">♪</div>
              {/if}
              <div class="ex-am-card-body">
                <div class="ex-am-title">{pick.title}</div>
                {#if pick.artistName}<div class="ex-am-artist">{pick.artistName}</div>{/if}
                <div class="ex-am-reason">{pick.reason}</div>
                <div class="ex-am-actions">
                  <button
                    type="button"
                    class="ex-am-play"
                    disabled={appleExploreBusyId === (pick.appleMusicId ?? pick.title)}
                    on:click={() => playExplorePick(pick)}
                  >
                    {appleExploreBusyId === (pick.appleMusicId ?? pick.title) ? '…' : 'Play'}
                  </button>
                  <button
                    type="button"
                    class="ex-am-ask"
                    on:click={() =>
                      ask(`Why might I like “${pick.title}”${pick.artistName ? ` by ${pick.artistName}` : ''}?`)}
                  >
                    Ask twin
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Calendar -->
  {#if $profile.googleConnected}
    <section class="ex-section">
      <SectionHeader title="Today" />
      {#if calLoading}
        <div class="ex-glass-row"><div class="skeleton" style="height:14px;width:50px;border-radius:6px;flex-shrink:0;"></div><div class="skeleton" style="height:14px;width:70%;border-radius:6px;"></div></div>
        <div class="ex-glass-row"><div class="skeleton" style="height:14px;width:50px;border-radius:6px;flex-shrink:0;"></div><div class="skeleton" style="height:14px;width:55%;border-radius:6px;"></div></div>
      {:else if calError}
        <p class="ex-muted">Couldn't reach calendar.</p>
      {:else if upcoming.length === 0}
        <div class="ex-glass-row"><span class="ex-glass-text">Nothing upcoming — your day is clear.</span></div>
      {:else}
        {#each upcoming as ev (ev.start + ev.title)}
          <div class="ex-glass-row">
            <span class="ex-glass-meta">{fmtTime(ev)}</span>
            <span class="ex-glass-text">{ev.title}</span>
          </div>
        {/each}
      {/if}
    </section>
  {/if}

  <!-- Inbox -->
  {#if $profile.googleConnected}
    <section class="ex-section">
      <SectionHeader title="Inbox" />
      {#if gmailLoading}
        <div class="ex-glass-row"><div class="skeleton" style="height:14px;width:85%;border-radius:6px;"></div></div>
        <div class="ex-glass-row"><div class="skeleton" style="height:14px;width:65%;border-radius:6px;"></div></div>
      {:else if gmailError}
        <p class="ex-muted">Inbox unavailable.</p>
      {:else if inboxLines.length === 0}
        <div class="ex-glass-row"><span class="ex-glass-text">Inbox is quiet.</span></div>
      {:else}
        {#each inboxLines as line, i (i)}
          <div class="ex-glass-row"><span class="ex-glass-text">{line}</span></div>
        {/each}
      {/if}
    </section>
  {/if}

  <!-- Recs — image cards -->
  <section class="ex-section">
    <SectionHeader title="For you" />
    {#if recsLoading}
      <div class="ex-recs-grid">
        {#each [1,2,3,4] as _}
          <div class="ex-rec-skel"></div>
        {/each}
      </div>
    {:else if topRecs.length > 0}
      <div class="ex-recs-grid">
        {#each topRecs as card (card.title + card.url)}
          <button type="button" class="ex-rec" on:click={() => ask(`Tell me more about: ${card.title}`)}>
            <img
              src={card.image_url || suggestionHeroUrl(card.category, 320, 200)}
              alt=""
              class="ex-rec-img"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div class="ex-rec-overlay">
              <span class="ex-rec-title">{card.title}</span>
              {#if card.category}<span class="ex-rec-cat">{card.category}</span>{/if}
            </div>
          </button>
        {/each}
      </div>
    {:else if !recsError}
      <EmptyState
        illustrationSrc={visualAssets.empty.feed.src}
        illustrationAlt={visualAssets.empty.feed.alt}
        headline="No picks yet"
        body="Ask your twin something — we'll tune from there."
        primaryLabel="Ask your twin"
        onPrimary={() => ask('Suggest something I would love today')}
      />
    {:else}
      <p class="ex-muted">Couldn't load picks.</p>
    {/if}
  </section>

  <!-- Ask tags -->
  <section class="ex-section">
    <SectionHeader title="Ask your twin" />
    <div class="ex-tags">
      {#each askTags as t (t.query)}
        <button type="button" class="ex-tag" on:click={() => ask(t.query)}>{t.label}</button>
      {/each}
    </div>
  </section>

  <div class="ex-end" aria-hidden="true"></div>
</div>

<style>
  .ex {
    position: relative;
    padding: max(44px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-left))
      max(100px, calc(env(safe-area-inset-bottom) + 72px)) max(20px, env(safe-area-inset-right));
    overflow-x: hidden;
    min-height: 0;
  }

  /* ── Identity hero ── */
  .ex-hero {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 24px;
  }

  .ex-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-strong);
    box-shadow:
      var(--shadow-tall-card),
      0 0 0 4px var(--accent-soft);
    margin-bottom: 14px;
  }

  .ex-avatar--fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    font-weight: 600;
    color: var(--text-primary);
    background: linear-gradient(140deg, var(--brand-red-soft), var(--accent-soft));
    border-color: var(--border-strong);
  }

  .ex-hero-text {
    margin-bottom: 12px;
  }

  .ex-name {
    margin: 0;
    font-size: clamp(1.4rem, 5vw, 1.7rem);
    font-weight: 600;
    letter-spacing: -0.035em;
    color: var(--text-primary);
  }

  .ex-aesthetic {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text-muted);
    max-width: 30ch;
  }

  .ex-identity-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    max-width: 340px;
  }

  .ex-id-tag {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
    background: var(--glass-light);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
  }

  .ex-context-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    max-width: 340px;
    margin-top: 10px;
  }

  .ex-ctx-tag {
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--calendar-today-bg);
    border: 1px solid var(--calendar-today-border);
    border-radius: 999px;
  }

  /* ── Vibes strip ── */
  .ex-vibes {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 2px;
    margin-bottom: 24px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .ex-vibes::-webkit-scrollbar { display: none; }

  .ex-vibe-card {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 140px;
    max-width: 180px;
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--glass-light);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    border: 1px solid var(--border-subtle);
  }

  .ex-vibe-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .ex-vibe-val {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.45;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Apple Music discovery strip ── */
  .ex-am-intro {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .ex-am-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin-right: -4px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .ex-am-card {
    flex-shrink: 0;
    width: min(240px, 78vw);
    border-radius: 16px;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ex-am-art {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
    background: var(--panel-surface);
  }

  .ex-am-art--ph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--text-muted);
    opacity: 0.5;
  }

  .ex-am-card-body {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
  }

  .ex-am-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ex-am-artist {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .ex-am-reason {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.35;
    margin-top: 2px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ex-am-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .ex-am-play {
    margin: 0;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--brand-red-soft);
    border: 1px solid var(--pill-warn-border);
    border-radius: 999px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .ex-am-play:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .ex-am-ask {
    margin: 0;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .ex-am-skel-row {
    display: flex;
    gap: 12px;
    overflow: hidden;
  }

  .ex-am-skel-card {
    flex-shrink: 0;
    width: min(240px, 78vw);
    height: 280px;
    border-radius: 16px;
    background: var(--panel-surface);
    border: 1px solid var(--panel-border);
    animation: ex-pulse 1.6s ease-in-out infinite;
  }

  /* ── Sections ── */
  .ex-section {
    position: relative;
    z-index: 1;
    margin-bottom: 28px;
  }

  .ex-muted {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  /* ── Glass rows (cal / inbox) ── */
  .ex-glass-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 13px 16px;
    margin-bottom: 8px;
    border-radius: 14px;
    background: var(--glass-light);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid var(--border-subtle);
  }

  .ex-glass-row:last-child {
    margin-bottom: 0;
  }

  .ex-glass-meta {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--brand-red);
    opacity: 0.85;
    min-width: 56px;
  }

  .ex-glass-text {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: var(--text-primary);
    letter-spacing: -0.015em;
  }

  /* ── Rec cards ── */
  .ex-recs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  @media (min-width: 768px) {
    .ex {
      padding-left: max(28px, env(safe-area-inset-left));
      padding-right: max(28px, env(safe-area-inset-right));
    }
    .ex-identity-tags {
      max-width: min(36rem, 100%);
    }
    .ex-recs-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
  }

  @media (min-width: 1024px) {
    .ex-recs-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .ex-rec-skel {
    aspect-ratio: 4/3;
    border-radius: 14px;
    background: var(--panel-surface);
    border: 1px solid var(--panel-border);
    animation: ex-pulse 1.6s ease-in-out infinite;
  }

  @keyframes ex-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  .ex-rec {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    margin: 0;
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    overflow: hidden;
    background: var(--panel-surface-soft);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    aspect-ratio: 4/3;
    transition:
      transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
      border-color 0.3s ease,
      box-shadow 0.3s ease;
  }

  .ex-rec:hover {
    border-color: var(--panel-hover-border);
    transform: scale(1.02);
    box-shadow: var(--shadow-tall-card);
  }

  .ex-rec:active {
    transform: scale(0.98);
    transition-duration: 0.1s;
  }

  .ex-rec-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .ex-rec-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 12px;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.82) 0%,
      rgba(0, 0, 0, 0.25) 55%,
      transparent 100%
    );
  }

  .ex-rec-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-on-media);
    line-height: 1.25;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ex-rec-cat {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-on-media-muted);
    margin-top: 3px;
  }

  /* ── Ask tags ── */
  .ex-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ex-tag {
    padding: 10px 16px;
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--glass-light);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background 0.25s ease,
      color 0.25s ease,
      border-color 0.25s ease,
      transform 0.2s ease;
  }

  .ex-tag:hover {
    color: var(--text-primary);
    background: var(--brand-red-soft);
    border-color: var(--pill-warn-border);
  }

  .ex-tag:active {
    transform: scale(0.97);
  }

  .ex-end {
    height: calc(100px + env(safe-area-inset-bottom, 0px));
  }

  @media (min-width: 1024px) {
    .ex-end {
      height: max(28px, env(safe-area-inset-bottom, 0px));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ex-rec-skel {
      animation: none;
    }
  }
</style>
