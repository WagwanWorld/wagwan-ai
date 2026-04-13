<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { imageUrlForKeyword } from '$lib/identity/visualIdentity';

  export let suggestions: string[];

  const dispatch = createEventDispatcher<{ detail: { title: string; body: string } }>();

  function titleFromLine(s: string): string {
    const t = s.trim();
    const cut = t.split(/[.:]/);
    return cut[0]?.trim() || t.slice(0, 48);
  }
</script>

<section class="iv-block iv-sugg" aria-labelledby="iv-sugg-h">
  <h3 id="iv-sugg-h" class="iv-block__h">Immediate suggestions</h3>
  <div class="iv-sugg-grid">
    {#each suggestions as s, i}
      <button
        type="button"
        class="iv-sugg-card"
        on:click={() => dispatch('detail', { title: titleFromLine(s), body: s })}
      >
        <div class="iv-sugg-card__imgwrap">
          <img src={imageUrlForKeyword(`action suggestion ${s}`, 'wide')} alt="" class="iv-sugg-card__img" />
        </div>
        <p class="iv-sugg-card__text">{s}</p>
      </button>
    {/each}
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

  .iv-sugg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .iv-sugg-card {
    text-align: left;
    border: none;
    padding: 0;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    background: var(--iv-surface-2, #fff);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.08));
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .iv-sugg-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1);
  }

  .iv-sugg-card__imgwrap {
    aspect-ratio: 16/9;
    background: #e8e4de;
  }

  .iv-sugg-card__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .iv-sugg-card__text {
    margin: 0;
    padding: 12px 14px 14px;
    font-size: 0.84rem;
    font-weight: 600;
    line-height: 1.45;
    color: var(--iv-text, #14120f);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .iv-sugg-card {
      transition: none;
    }
    .iv-sugg-card:hover {
      transform: none;
    }
  }
</style>
