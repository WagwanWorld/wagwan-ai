<script lang="ts">
  import type { IdentitySynthesisMoodBoard } from '$lib/types/identitySynthesis';
  import { imageUrlForKeyword, parseColorSwatches } from '$lib/identity/visualIdentity';

  export let mood: IdentitySynthesisMoodBoard;

  $: swatches = parseColorSwatches(mood.color_palette);
  $: gridRefs = [...mood.references, ...mood.environments].slice(0, 9);
</script>

<section class="iv-block" aria-labelledby="iv-mood-h">
  <h3 id="iv-mood-h" class="iv-block__h">Mood board</h3>

  {#if swatches.length}
    <div class="iv-mood-swatches">
      {#each swatches as s}
        <div class="iv-swatch">
          <div class="iv-swatch__blob" style:background={s.css}></div>
          <span class="iv-swatch__label">{s.label}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if gridRefs.length}
    <div class="iv-mood-masonry" role="list">
      {#each gridRefs as ref, i}
        <div class="iv-mood-tile" class:iv-mood-tile--tall={i % 4 === 1} role="listitem">
          <img src={imageUrlForKeyword(ref, i % 3 === 0 ? 'tall' : 'square')} alt="" class="iv-mood-tile__img" />
        </div>
      {/each}
    </div>
  {/if}

  {#if mood.textures.length}
    <p class="iv-textures-h">Textures</p>
    <div class="iv-texture-strip">
      {#each mood.textures as tex}
        <div class="iv-texture-cell">
          <img src={imageUrlForKeyword(`texture ${tex}`, 'wide')} alt="" class="iv-texture-img" />
          <span class="iv-texture-cap">{tex}</span>
        </div>
      {/each}
    </div>
  {/if}
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

  .iv-mood-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 1rem;
  }

  .iv-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 72px;
  }

  .iv-swatch__blob {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  .iv-swatch__label {
    font-size: 0.62rem;
    font-weight: 600;
    text-align: center;
    color: var(--iv-secondary, #4a4640);
    max-width: 100px;
    line-height: 1.25;
  }

  .iv-mood-masonry {
    column-count: 2;
    column-gap: 10px;
    margin-bottom: 1rem;
  }

  @media (min-width: 560px) {
    .iv-mood-masonry {
      column-count: 3;
    }
  }

  .iv-mood-tile {
    break-inside: avoid;
    margin-bottom: 10px;
    border-radius: 14px;
    overflow: hidden;
    background: #e8e4de;
  }

  .iv-mood-tile--tall .iv-mood-tile__img {
    min-height: 180px;
  }

  .iv-mood-tile__img {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .iv-textures-h {
    margin: 0 0 0.5rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-texture-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .iv-texture-cell {
    flex: 0 0 120px;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.07));
  }

  .iv-texture-img {
    width: 100%;
    height: 56px;
    object-fit: cover;
    display: block;
  }

  .iv-texture-cap {
    display: block;
    font-size: 0.62rem;
    padding: 6px 8px;
    color: var(--iv-secondary, #4a4640);
    line-height: 1.25;
  }
</style>
