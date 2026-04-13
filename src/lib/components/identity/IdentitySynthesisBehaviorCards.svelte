<script lang="ts">
  import type { IdentitySynthesisBehavioralPatterns } from '$lib/types/identitySynthesis';
  import Brain from 'phosphor-svelte/lib/Brain';
  import Crosshair from 'phosphor-svelte/lib/Crosshair';
  import UsersThree from 'phosphor-svelte/lib/UsersThree';
  import ShieldWarning from 'phosphor-svelte/lib/ShieldWarning';

  export let behavior: IdentitySynthesisBehavioralPatterns;

  const rows = [
    { key: 'decision_making' as const, label: 'Decision style', icon: Brain, text: behavior.decision_making },
    { key: 'attention' as const, label: 'Attention', icon: Crosshair, text: behavior.attention },
    { key: 'social_vs_solo' as const, label: 'Social vs solo', icon: UsersThree, text: behavior.social_vs_solo },
    { key: 'risk_appetite' as const, label: 'Risk appetite', icon: ShieldWarning, text: behavior.risk_appetite },
  ];
</script>

<section class="iv-block" aria-labelledby="iv-beh-h">
  <h3 id="iv-beh-h" class="iv-block__h">Behavioral insights</h3>
  <div class="iv-beh-grid">
    {#each rows as row}
      <article class="iv-beh-card">
        <div class="iv-beh-card__ico" aria-hidden="true">
          <svelte:component this={row.icon} size={22} weight="light" />
        </div>
        <p class="iv-beh-card__label">{row.label}</p>
        <p class="iv-beh-card__text">{row.text}</p>
      </article>
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

  .iv-beh-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .iv-beh-card {
    border-radius: 16px;
    padding: 14px;
    background: var(--iv-surface-2, #fff);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.07));
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  }

  .iv-beh-card__ico {
    color: var(--iv-text, #14120f);
    opacity: 0.85;
    margin-bottom: 8px;
  }

  .iv-beh-card__label {
    margin: 0 0 0.35rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-beh-card__text {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--iv-text, #14120f);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
