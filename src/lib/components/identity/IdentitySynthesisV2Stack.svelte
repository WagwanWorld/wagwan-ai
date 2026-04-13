<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type {
    IdentitySynthesisActivationAgentId,
    IdentitySynthesisPayloadV2,
  } from '$lib/types/identitySynthesis';
  import { imageUrlForKeyword, colorSwatchesFromNamedHex } from '$lib/identity/visualIdentity';
  import IdentitySynthesisHero from '$lib/components/identity/IdentitySynthesisHero.svelte';
  import IdentitySynthesisProfessionsGrid from '$lib/components/identity/IdentitySynthesisProfessionsGrid.svelte';
  import IdentitySynthesisContradictionsSplit from '$lib/components/identity/IdentitySynthesisContradictionsSplit.svelte';

  export let payload: IdentitySynthesisPayloadV2;
  export let photoUrl: string | null = null;

  const dispatch = createEventDispatcher<{ detail: { title: string; body: string } }>();

  $: active = new Set(payload.activation.primary_agents);
  $: swatches = colorSwatchesFromNamedHex(payload.moodboard.color_palette);
  $: profRoles = payload.professional.suggested_roles.map(r => ({
    title: r.role,
    why_it_fits: r.reason,
    level: r.type,
  }));
  $: heroCore = {
    archetype: payload.synthesis.core_identity,
    personality_traits: payload.synthesis.top_traits,
    energy: payload.synthesis.dominant_signals.slice(0, 4).join(' · ') || '—',
    social_style: payload.synthesis.resolved_identity,
  };
  $: tensionLines = [
    ...payload.behavioral.contradictions,
    ...payload.synthesis.conflicts,
  ].filter(Boolean);
  $: knowEntries = Object.entries(payload.synthesis.what_we_know_about_you ?? {});

  function isHot(id: IdentitySynthesisActivationAgentId): boolean {
    return active.has(id);
  }
</script>

<section class="iv2" aria-label="Identity synthesis v2">
  {#if payload.activation.user_query_echo}
    <div class="iv2-activation">
      <p class="iv2-activation__label">Active lens</p>
      <p class="iv2-activation__q">“{payload.activation.user_query_echo}”</p>
      <p class="iv2-activation__why">{payload.activation.rationale}</p>
    </div>
  {/if}

  <IdentitySynthesisHero {photoUrl} musicGalleryUrls={[]} core={heroCore} />

  <div
    class="iv2-direction"
    class:iv2-direction--hot={isHot('professional')}
    id="iv2-direction"
    data-agent="direction"
  >
    <h3 class="iv2-h">Direction</h3>
    <p class="iv2-lead">{payload.synthesis.resolved_identity}</p>
    {#if knowEntries.length}
      <ul class="iv2-know">
        {#each knowEntries as [k, v]}
          <li><strong>{k}</strong> — {v}</li>
        {/each}
      </ul>
    {/if}
    <p class="iv2-conf iv2-conf--synthesis">{payload.synthesis.confidence}</p>

    <p class="iv2-subh iv2-subh--in-direction">Professional signal</p>
    <p class="iv2-lead iv2-lead--compact">{payload.professional.current_signal}</p>
    <p class="iv2-muted">{payload.professional.trajectory_direction}</p>
    <IdentitySynthesisProfessionsGrid
      embedded
      roles={profRoles}
      on:detail={e => dispatch('detail', e.detail)}
    />
    <p class="iv2-subh">Skills</p>
    <p class="iv2-muted">{payload.professional.skill_graph.join(' · ')}</p>
    <p class="iv2-conf">{payload.professional.confidence}</p>
  </div>

  <div class="iv2-grid">
    <section class="iv2-panel" class:iv2-panel--hot={isHot('fashion')} id="iv2-fashion" data-agent="fashion">
      <h3 class="iv2-h">Fashion</h3>
      <p class="iv2-archetype">{payload.fashion.style_archetype}</p>
      <p class="iv2-conf">{payload.fashion.confidence}</p>
      <div class="iv2-tags">
        {#each payload.fashion.style_breakdown.silhouettes as s}<span class="iv2-pill">{s}</span>{/each}
      </div>
      {#if payload.fashion.brand_affinity.length}
        <ul class="iv2-list">
          {#each payload.fashion.brand_affinity as b}
            <li><span class="iv2-tier">{b.tier}</span> {b.brand} — {b.reason}</li>
          {/each}
        </ul>
      {/if}
      {#if payload.fashion.product_suggestions.length}
        <p class="iv2-subh">Products</p>
        <ul class="iv2-list">
          {#each payload.fashion.product_suggestions as pr}
            <li><strong>{pr.brand}</strong> {pr.item} — {pr.why}</li>
          {/each}
        </ul>
      {/if}
      {#if payload.fashion.avoid_patterns.length}
        <p class="iv2-subh">Avoid</p>
        <p class="iv2-muted">{payload.fashion.avoid_patterns.join(' · ')}</p>
      {/if}
      <div class="iv2-imgs" role="list">
        {#each payload.fashion.image_queries as q, i}
          <img
            src={imageUrlForKeyword(q, i % 3 === 0 ? 'tall' : 'square')}
            alt=""
            class="iv2-imgs__img"
            role="listitem"
          />
        {/each}
      </div>
    </section>

    <section class="iv2-panel" class:iv2-panel--hot={isHot('commerce')} id="iv2-commerce" data-agent="commerce">
      <h3 class="iv2-h">Commerce</h3>
      <p class="iv2-conf">{payload.commerce.confidence}</p>
      <p class="iv2-subh">High intent</p>
      <p class="iv2-muted">{payload.commerce.high_intent_categories.join(' · ')}</p>
      <p class="iv2-subh">Aspirational</p>
      <p class="iv2-muted">{payload.commerce.aspirational_categories.join(' · ')}</p>
      <p class="iv2-subh">Purchase behavior</p>
      <p>{payload.commerce.purchase_behavior.price_sensitivity} · {payload.commerce.purchase_behavior.frequency}</p>
      {#if payload.commerce.product_recommendations.length}
        <ul class="iv2-list">
          {#each payload.commerce.product_recommendations as r}
            <li>{r.product} ({r.price_range}) — {r.reason}</li>
          {/each}
        </ul>
      {/if}
      <div class="iv2-imgs" role="list">
        {#each payload.commerce.image_queries as q, i}
          <img src={imageUrlForKeyword(q, i % 2 ? 'wide' : 'square')} alt="" class="iv2-imgs__img" role="listitem" />
        {/each}
      </div>
    </section>

    <section class="iv2-panel" class:iv2-panel--hot={isHot('moodboard')} id="iv2-moodboard" data-agent="moodboard">
      <h3 class="iv2-h">Moodboard</h3>
      <p class="iv2-archetype">{payload.moodboard.aesthetic_archetype}</p>
      <p class="iv2-conf">{payload.moodboard.confidence}</p>
      {#if swatches.length}
        <div class="iv2-swatches">
          {#each swatches as s}
            <div class="iv2-swatch">
              <div class="iv2-swatch__blob" style:background={s.css}></div>
              <span class="iv2-swatch__label">{s.label}</span>
            </div>
          {/each}
        </div>
      {/if}
      <p class="iv2-muted">{payload.moodboard.visual_themes.join(' · ')}</p>
      <div class="iv2-imgs" role="list">
        {#each payload.moodboard.image_queries as q, i}
          <img src={imageUrlForKeyword(q, 'tall')} alt="" class="iv2-imgs__img" role="listitem" />
        {/each}
      </div>
    </section>

    <section class="iv2-panel" class:iv2-panel--hot={isHot('taste_culture')} id="iv2-taste" data-agent="taste_culture">
      <h3 class="iv2-h">Taste & culture</h3>
      <p class="iv2-archetype">{payload.taste_culture.taste_archetype}</p>
      <p>{payload.taste_culture.cultural_positioning}</p>
      <p class="iv2-conf">{payload.taste_culture.confidence}</p>
      <div class="iv2-tags">
        {#each payload.taste_culture.genre_clusters as g}<span class="iv2-pill">{g}</span>{/each}
      </div>
      <div class="iv2-imgs" role="list">
        {#each payload.taste_culture.image_queries as q, i}
          <img src={imageUrlForKeyword(q, i % 2 ? 'square' : 'wide')} alt="" class="iv2-imgs__img" role="listitem" />
        {/each}
      </div>
    </section>

    <section class="iv2-panel" class:iv2-panel--hot={isHot('behavioral')} id="iv2-behavioral" data-agent="behavioral">
      <h3 class="iv2-h">Behavioral</h3>
      <div class="iv2-beh">
        <p><strong>Decision</strong> — {payload.behavioral.decision_style}</p>
        <p><strong>Attention</strong> — {payload.behavioral.attention_pattern}</p>
        <p><strong>Risk</strong> — {payload.behavioral.risk_profile}</p>
        <p><strong>Social</strong> — {payload.behavioral.social_orientation}</p>
      </div>
      {#if payload.behavioral.behavioral_traits.length}
        <div class="iv2-tags">
          {#each payload.behavioral.behavioral_traits as t}<span class="iv2-pill">{t}</span>{/each}
        </div>
      {/if}
      <p class="iv2-conf">{payload.behavioral.confidence}</p>
    </section>
  </div>

  {#if tensionLines.length}
    <IdentitySynthesisContradictionsSplit lines={tensionLines} />
  {/if}
</section>

<style>
  .iv2 {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .iv2-activation {
    border-radius: 16px;
    padding: 1rem 1.1rem;
    background: var(--iv-surface-2, #fff);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.08));
  }

  .iv2-activation__label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
    margin: 0 0 0.35rem;
  }

  .iv2-activation__q {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    font-style: italic;
    color: var(--iv-text, #14120f);
  }

  .iv2-activation__why {
    margin: 0;
    font-size: 0.8rem;
    color: var(--iv-secondary, #4a4640);
    line-height: 1.45;
  }

  .iv2-h {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
    margin: 0 0 0.65rem;
  }

  .iv2-direction {
    padding: 1rem;
    border-radius: 18px;
    background: var(--iv-surface, #faf8f5);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.07));
    transition:
      box-shadow 0.15s ease,
      border-color 0.15s ease;
  }

  .iv2-direction--hot {
    border-color: rgba(180, 120, 60, 0.35);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.07);
  }

  .iv2-direction :global(.iv-block--embedded) {
    border: none;
    background: rgba(255, 255, 255, 0.55);
    margin-top: 0.5rem;
    border-radius: 12px;
    padding: 0.65rem 0.75rem 0.85rem;
  }

  .iv2-lead {
    margin: 0 0 0.75rem;
    font-size: 0.92rem;
    line-height: 1.5;
    color: var(--iv-text, #14120f);
  }

  .iv2-lead--compact {
    font-size: 0.86rem;
    margin-bottom: 0.5rem;
  }

  .iv2-subh--in-direction {
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--iv-border, rgba(0, 0, 0, 0.06));
  }

  .iv2-conf--synthesis {
    margin-bottom: 0.15rem;
  }

  .iv2-know {
    margin: 0 0 0.75rem;
    padding-left: 1.1rem;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--iv-secondary, #4a4640);
  }

  .iv2-conf {
    margin: 0;
    font-size: 0.72rem;
    color: var(--iv-muted, #6b6560);
  }

  .iv2-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .iv2-panel {
    border-radius: 18px;
    padding: 1rem 1.05rem;
    background: var(--iv-surface-2, #fff);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.07));
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .iv2-panel--hot {
    border-color: rgba(180, 120, 60, 0.35);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.07);
  }

  .iv2-archetype {
    margin: 0 0 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .iv2-subh {
    margin: 0.75rem 0 0.25rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv2-muted {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--iv-secondary, #4a4640);
  }

  .iv2-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 0.5rem;
  }

  .iv2-pill {
    font-size: 0.68rem;
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.05);
    color: var(--iv-text, #14120f);
  }

  .iv2-tier {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--iv-muted, #6b6560);
    margin-right: 0.35rem;
  }

  .iv2-list {
    margin: 0.5rem 0 0;
    padding-left: 1rem;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--iv-secondary, #4a4640);
  }

  .iv2-imgs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
    margin-top: 0.75rem;
  }

  .iv2-imgs__img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.06));
  }

  .iv2-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 0.75rem 0;
  }

  .iv2-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 64px;
  }

  .iv2-swatch__blob {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.08));
  }

  .iv2-swatch__label {
    font-size: 0.65rem;
    color: var(--iv-muted, #6b6560);
    text-align: center;
    max-width: 88px;
  }

  .iv2-beh p {
    margin: 0 0 0.5rem;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--iv-secondary, #4a4640);
  }
</style>
