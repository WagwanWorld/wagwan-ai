<script lang="ts">
  import type { IdentitySynthesisTasteProfile } from '$lib/types/identitySynthesis';
  import { imageUrlForKeyword, tastePillsFromText } from '$lib/identity/visualIdentity';

  export let taste: IdentitySynthesisTasteProfile;
  /** When length matches the collage slice, replaces Picsum with resolved artwork URLs */
  export let collageUrls: string[] | undefined = undefined;

  $: pills = tastePillsFromText(taste.music + ' ' + taste.cultural_alignment, 10);
  $: collageKeys = pills.slice(0, 6);
  $: resolvedUrls =
    collageUrls && collageUrls.length === collageKeys.length
      ? collageUrls
      : collageKeys.map((k, i) =>
          imageUrlForKeyword(`music taste ${k}`, i % 2 ? 'wide' : 'square')
        );
</script>

<section class="iv-block iv-taste" aria-labelledby="iv-taste-h">
  <h3 id="iv-taste-h" class="iv-block__h">Taste profile</h3>
  <div class="iv-taste__grid">
    <div class="iv-taste__copy">
      <p class="iv-taste__p">{taste.music}</p>
      <p class="iv-taste__p iv-taste__p--muted">{taste.cultural_alignment}</p>
      <p class="iv-taste__p iv-taste__p--muted">{taste.content_consumption}</p>
      <div class="iv-taste__pills">
        {#each pills as p}
          <span class="iv-taste__pill">{p}</span>
        {/each}
      </div>
    </div>
    <div class="iv-taste__visual" aria-hidden="true">
      <div class="iv-taste__collage">
        {#each collageKeys as k, i}
          <div class="iv-taste__cell" class:iv-taste__cell--wide={i === 0}>
            <img src={resolvedUrls[i]} alt="" class="iv-taste__img" referrerpolicy="no-referrer" />
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .iv-block {
    margin: 0;
  }

  .iv-block__h {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
    margin: 0 0 0.85rem;
  }

  .iv-taste__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .iv-taste__grid {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }

  .iv-taste__p {
    margin: 0 0 0.65rem;
    font-size: 0.88rem;
    line-height: 1.55;
    color: var(--iv-text, #14120f);
  }

  .iv-taste__p--muted {
    color: var(--iv-secondary, #4a4640);
    font-size: 0.84rem;
  }

  .iv-taste__pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }

  .iv-taste__pill {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.06);
    color: var(--iv-text, #14120f);
  }

  .iv-taste__collage {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .iv-taste__cell {
    border-radius: 14px;
    overflow: hidden;
    min-height: 88px;
    background: #e8e4de;
  }

  .iv-taste__cell--wide {
    grid-column: span 2;
    min-height: 100px;
  }

  .iv-taste__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
</style>
