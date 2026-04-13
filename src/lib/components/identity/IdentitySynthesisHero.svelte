<script lang="ts">
  import type { IdentitySynthesisCoreIdentity } from '$lib/types/identitySynthesis';
  import { gradientFromSeed, hashString, imageUrlForKeyword } from '$lib/identity/visualIdentity';

  export let core: IdentitySynthesisCoreIdentity;
  export let photoUrl: string | null = null;
  /** Optional iTunes / album artwork URLs to replace decorative Picsum tiles */
  export let musicGalleryUrls: string[] = [];
  /** Tighter copy + fewer pills when nested in the overview strip */
  export let overviewMode = false;

  $: seed = hashString(core.archetype + core.energy);
  $: bg = gradientFromSeed(seed, true);
  $: collageKeys = [
    core.archetype,
    ...core.personality_traits.slice(0, overviewMode ? 2 : 3),
    core.social_style.slice(0, 24),
  ].filter(Boolean);
  $: maxLede = overviewMode ? 96 : 120;
  $: oneLine =
    core.energy.length > maxLede ? core.energy.slice(0, maxLede - 3) + '…' : core.energy;
</script>

<section class="iv-hero" class:iv-hero--overview={overviewMode} style:--iv-hero-bg={bg}>
  <div class="iv-hero__inner">
    <div class="iv-hero__copy">
      <p class="iv-hero__eyebrow">{overviewMode ? 'Snapshot' : 'Identity snapshot'}</p>
      <h2 class="iv-hero__title">{core.archetype}</h2>
      <p class="iv-hero__lede">{oneLine}</p>
      <div class="iv-hero__pills">
        {#each core.personality_traits.slice(0, overviewMode ? 4 : 24) as t}
          <span class="iv-hero__pill">{t}</span>
        {/each}
      </div>
    </div>
    <div class="iv-hero__collage" aria-hidden="true">
      {#if photoUrl}
        <div class="iv-hero__cell iv-hero__cell--photo">
          <img src={photoUrl} alt="" class="iv-hero__img" referrerpolicy="no-referrer" />
        </div>
      {/if}
      {#each collageKeys.slice(0, photoUrl ? 4 : 5) as key, i}
        <div class="iv-hero__cell" class:iv-hero__cell--tall={i % 3 === 1}>
          <img
            src={musicGalleryUrls[i] ?? imageUrlForKeyword(`${key}-${i}`, i % 2 ? 'wide' : 'square')}
            alt=""
            class="iv-hero__img"
            referrerpolicy="no-referrer"
          />
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .iv-hero {
    border-radius: 20px;
    padding: 1.25rem;
    background: var(--iv-hero-bg, #f7f4ef);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.06));
    margin-bottom: 0.5rem;
  }

  .iv-hero--overview {
    margin-bottom: 0;
    border-radius: 18px 18px 0 0;
    border-bottom: none;
  }

  .iv-hero__inner {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  @media (min-width: 720px) {
    .iv-hero__inner {
      grid-template-columns: 1fr 1.15fr;
      align-items: center;
    }
  }

  .iv-hero__eyebrow {
    margin: 0 0 0.35rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-hero__title {
    margin: 0 0 0.5rem;
    font-size: clamp(1.35rem, 3vw, 1.75rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--iv-text, #14120f);
    line-height: 1.15;
  }

  .iv-hero__lede {
    margin: 0 0 0.85rem;
    font-size: 0.92rem;
    line-height: 1.5;
    color: var(--iv-secondary, #3d3a36);
    max-width: 36ch;
  }

  .iv-hero__pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .iv-hero__pill {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(0, 0, 0, 0.06);
    color: var(--iv-text, #14120f);
  }

  .iv-hero__collage {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 76px;
    gap: 8px;
  }

  .iv-hero__cell {
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .iv-hero__cell--tall {
    grid-row: span 2;
  }

  .iv-hero__cell--photo {
    grid-row: span 2;
    grid-column: span 1;
  }

  .iv-hero__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    .iv-hero__cell {
      transition: none;
    }
  }
</style>
