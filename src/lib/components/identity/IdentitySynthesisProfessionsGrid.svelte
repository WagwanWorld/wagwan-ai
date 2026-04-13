<script lang="ts">
  import type { IdentitySynthesisProfessionRole } from '$lib/types/identitySynthesis';
  import { imageUrlForKeyword } from '$lib/identity/visualIdentity';
  import { createEventDispatcher } from 'svelte';
  import type { Component } from 'svelte';
  import Briefcase from 'phosphor-svelte/lib/Briefcase';
  import LinkSimple from 'phosphor-svelte/lib/LinkSimple';
  import TrendUp from 'phosphor-svelte/lib/TrendUp';

  export let roles: IdentitySynthesisProfessionRole[];
  /** Softer label + shorter blurbs when stacked under overview hero */
  export let embedded = false;

  const dispatch = createEventDispatcher<{ detail: { title: string; body: string } }>();

  function levelIcon(level: string): Component {
    if (level === 'aspirational') return TrendUp;
    if (level === 'adjacent') return LinkSimple;
    return Briefcase;
  }

  function levelLabel(level: string): string {
    if (level === 'aspirational') return 'Aspirational';
    if (level === 'current') return 'Current';
    if (level === 'adjacent') return 'Adjacent';
    return level;
  }

  function snip(s: string, max: number): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + '…';
  }

  $: whyMax = embedded ? 100 : 140;
</script>

<section
  class="iv-block"
  class:iv-block--embedded={embedded}
  aria-labelledby={embedded ? 'iv-prof-emb' : 'iv-prof-h'}
>
  {#if embedded}
    <p id="iv-prof-emb" class="iv-block__sub">Roles that fit</p>
  {:else}
    <h3 id="iv-prof-h" class="iv-block__h">Suggested professions</h3>
  {/if}
  <div class="iv-prof-grid">
    {#each roles as r}
      {@const LvIcon = levelIcon(r.level)}
      <button
        type="button"
        class="iv-prof-card"
        on:click={() => dispatch('detail', { title: r.title, body: r.why_it_fits })}
      >
        <div class="iv-prof-card__visual">
          <img src={imageUrlForKeyword(r.title, 'wide')} alt="" class="iv-prof-card__img" />
          <span class="iv-prof-card__lvl-ico" aria-hidden="true">
            <svelte:component this={LvIcon} size={16} weight="light" />
          </span>
          <span class="iv-prof-card__badge">{levelLabel(r.level)}</span>
        </div>
        <div class="iv-prof-card__body">
          <p class="iv-prof-card__title">{r.title}</p>
          <p class="iv-prof-card__why">{snip(r.why_it_fits, whyMax)}</p>
        </div>
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

  .iv-block--embedded {
    padding: 0 1rem 1rem;
    margin: 0;
    border-radius: 0 0 18px 18px;
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.06));
    border-top: none;
    background: var(--iv-surface-2, #fff);
  }

  .iv-block__sub {
    margin: 0 0 0.65rem;
    padding-top: 0.35rem;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-prof-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .iv-prof-card {
    text-align: left;
    border: none;
    padding: 0;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    background: var(--iv-surface-2, #fff);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.07));
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .iv-prof-card:hover {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  }

  .iv-prof-card__visual {
    position: relative;
    aspect-ratio: 16/10;
    background: #e8e4de;
  }

  .iv-prof-card__lvl-ico {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.92);
    color: var(--iv-text, #14120f);
    border: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .iv-prof-card__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .iv-prof-card__badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    color: var(--iv-text, #14120f);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .iv-prof-card__body {
    padding: 10px 12px 12px;
  }

  .iv-prof-card__title {
    margin: 0 0 0.35rem;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--iv-text, #14120f);
    line-height: 1.25;
  }

  .iv-prof-card__why {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--iv-secondary, #4a4640);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .iv-prof-card {
      transition: none;
    }
    .iv-prof-card:hover {
      transform: none;
    }
  }
</style>
