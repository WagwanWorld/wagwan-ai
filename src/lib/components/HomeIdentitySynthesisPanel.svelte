<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2,
    type IdentitySynthesisPayload,
    type IdentitySynthesisWrapper,
  } from '$lib/types/identitySynthesis';
  import type { IdentityMusicContext } from '$lib/types/identityMusicContext';
  import {
    getAlbumArtwork,
    prefetchArtistArtwork,
  } from '$lib/client/itunesArtwork';
  import { imageUrlForKeyword, tastePillsFromText } from '$lib/identity/visualIdentity';
  import IdentitySynthesisOverviewV1 from '$lib/components/identity/IdentitySynthesisOverviewV1.svelte';
  import IdentitySynthesisShoppingRows from '$lib/components/identity/IdentitySynthesisShoppingRows.svelte';
  import IdentitySynthesisMoodBoardVisual from '$lib/components/identity/IdentitySynthesisMoodBoardVisual.svelte';
  import IdentitySynthesisTasteSplit from '$lib/components/identity/IdentitySynthesisTasteSplit.svelte';
  import IdentitySynthesisBehaviorCards from '$lib/components/identity/IdentitySynthesisBehaviorCards.svelte';
  import IdentitySynthesisTrajectoryTimeline from '$lib/components/identity/IdentitySynthesisTrajectoryTimeline.svelte';
  import IdentitySynthesisContradictionsSplit from '$lib/components/identity/IdentitySynthesisContradictionsSplit.svelte';
  import IdentitySynthesisSuggestionsCards from '$lib/components/identity/IdentitySynthesisSuggestionsCards.svelte';
  import IdentitySynthesisExtrasSection from '$lib/components/identity/IdentitySynthesisExtrasSection.svelte';
  import IdentitySynthesisModal from '$lib/components/identity/IdentitySynthesisModal.svelte';
  import IdentitySynthesisV2Stack from '$lib/components/identity/IdentitySynthesisV2Stack.svelte';

  export let synthesis: IdentitySynthesisWrapper | null = null;
  export let photoUrl: string | null = null;
  export let regenerating = false;
  export let musicContext: IdentityMusicContext | null = null;

  const dispatch = createEventDispatcher<{ regenerate: void }>();

  let modalOpen = false;
  let modalTitle = '';
  let modalBody = '';

  let tasteCollageUrls: string[] = [];
  let heroMusicUrls: string[] = [];
  let identityArtGen = 0;

  function findFuzzyArtwork(pill: string, map: Record<string, string>): string | undefined {
    const kl = pill.toLowerCase();
    for (const [a, u] of Object.entries(map)) {
      const al = a.toLowerCase();
      if (al === kl || al.includes(kl) || kl.includes(al)) return u;
    }
    return undefined;
  }

  $: {
    const syn = synthesis;
    const mc = musicContext;
    const gen = ++identityArtGen;
    tasteCollageUrls = [];
    heroMusicUrls = [];
    if (!syn?.payload) {
      /* noop */
    } else if (syn.version === IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2) {
      tasteCollageUrls = [];
      heroMusicUrls = [];
    } else {
      void (async () => {
        const p = syn.payload;
        const pills = tastePillsFromText(
          p.taste_profile.music + ' ' + p.taste_profile.cultural_alignment,
          10
        );
        const artists = mc?.topArtists?.length ? mc.topArtists : [];
        const terms = [...new Set([...artists.slice(0, 8), ...pills.slice(0, 8)])];
        const map = await prefetchArtistArtwork(terms);

        const albumUrls: string[] = [];
        for (const rel of (mc?.latestReleases ?? []).slice(0, 4)) {
          const u = await getAlbumArtwork(rel.artistName, rel.title);
          if (u) albumUrls.push(u);
        }

        if (gen !== identityArtGen) return;

        const keys6 = pills.slice(0, 6);
        const nextTaste = keys6.map((k, i) => {
          const albumFallback =
            albumUrls.length > 0 ? albumUrls[i % albumUrls.length] : undefined;
          const hit = map[k] ?? findFuzzyArtwork(k, map) ?? albumFallback;
          if (hit) return hit;
          return imageUrlForKeyword(`music taste ${k}`, i % 2 ? 'wide' : 'square');
        });
        tasteCollageUrls = nextTaste;

        const pool = [...Object.values(map), ...albumUrls].filter(Boolean);
        heroMusicUrls = pool.slice(0, 5);
      })();
    }
  }

  function openModal(e: CustomEvent<{ title: string; body: string }>) {
    modalTitle = e.detail.title;
    modalBody = e.detail.body;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
  }
</script>

{#if synthesis?.payload && synthesis.version === IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2}
  <div class="id-synth-visual">
    <div class="id-synth-visual__toolbar">
      <button
        type="button"
        class="id-synth-visual__regen"
        disabled={regenerating}
        on:click={() => dispatch('regenerate')}
      >
        {regenerating ? 'Regenerating…' : 'Regenerate identity'}
      </button>
    </div>

    <IdentitySynthesisV2Stack payload={synthesis.payload} {photoUrl} on:detail={openModal} />

    <p class="id-synth-visual__foot">
      Artist and album art from Apple iTunes Search when available; brand marks from site favicons where we can infer a
      domain. Remaining tiles use seeded placeholders (Picsum). Regenerate to refresh the mirror.
    </p>
  </div>

  <IdentitySynthesisModal open={modalOpen} title={modalTitle} body={modalBody} on:close={closeModal} />
{:else if synthesis?.payload}
  {@const p = synthesis.payload as IdentitySynthesisPayload}
  <div class="id-synth-visual">
    <div class="id-synth-visual__toolbar">
      <button
        type="button"
        class="id-synth-visual__regen"
        disabled={regenerating}
        on:click={() => dispatch('regenerate')}
      >
        {regenerating ? 'Regenerating…' : 'Regenerate identity'}
      </button>
    </div>

    <IdentitySynthesisOverviewV1
      core={p.core_identity}
      roles={p.suggested_professions}
      {photoUrl}
      musicGalleryUrls={heroMusicUrls}
      on:detail={openModal}
    />

    <div class="id-synth-visual__stack">
      <IdentitySynthesisShoppingRows shopping={p.shopping_preferences} />
      <IdentitySynthesisMoodBoardVisual mood={p.mood_board} />
      <IdentitySynthesisTasteSplit taste={p.taste_profile} collageUrls={tasteCollageUrls} />
      <IdentitySynthesisBehaviorCards behavior={p.behavioral_patterns} />
      <IdentitySynthesisTrajectoryTimeline trajectory={p.trajectory} />
      <IdentitySynthesisContradictionsSplit lines={p.hidden_signals_and_contradictions} />
      <IdentitySynthesisSuggestionsCards suggestions={p.immediate_suggestions} on:detail={openModal} />
      {#if p.optional}
        <IdentitySynthesisExtrasSection optional={p.optional} />
      {/if}
    </div>

    <p class="id-synth-visual__foot">
      Artist and album art from Apple iTunes Search when available; brand marks from site favicons where we can infer a
      domain. Remaining tiles use seeded placeholders (Picsum). Regenerate to refresh the mirror.
    </p>
  </div>

  <IdentitySynthesisModal open={modalOpen} title={modalTitle} body={modalBody} on:close={closeModal} />
{/if}

<style>
  .id-synth-visual {
    --iv-text: #14120f;
    --iv-secondary: #4a4640;
    --iv-muted: #6b6560;
    --iv-bg: #f7f4ef;
    --iv-surface: #faf8f5;
    --iv-surface-2: #ffffff;
    --iv-border: rgba(0, 0, 0, 0.08);
    background: var(--iv-bg);
    border-radius: 22px;
    padding: 1rem 1rem 1.25rem;
    border: 1px solid var(--iv-border);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.08);
  }

  .id-synth-visual__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
  }

  .id-synth-visual__regen {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    border: 1px solid var(--iv-border);
    background: var(--iv-surface-2);
    color: var(--iv-text);
    cursor: pointer;
    transition:
      background 0.15s ease,
      opacity 0.15s ease;
  }

  .id-synth-visual__regen:hover:not(:disabled) {
    background: #fff;
  }

  .id-synth-visual__regen:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .id-synth-visual__stack {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .id-synth-visual__foot {
    margin: 1.25rem 0 0;
    font-size: 0.62rem;
    line-height: 1.45;
    color: var(--iv-muted);
    text-align: center;
    max-width: 44rem;
    margin-left: auto;
    margin-right: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .id-synth-visual__regen {
      transition: none;
    }
  }
</style>
