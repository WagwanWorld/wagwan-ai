<script lang="ts">
  import { topicIconForLine, topicThumbKeywordUrl } from '$lib/identity/topicVisual';

  export let items: { kind: 'interest' | 'need'; text: string }[];
  /** `home` = dark glass panel styles; `default` = light Tailwind-friendly */
  export let variant: 'home' | 'default' = 'home';
</script>

{#if items.length}
  <div class="inf-focus" data-variant={variant}>
    <p class="inf-focus__kicker">Focus</p>
    <div class="inf-focus__grid">
      {#each items as item}
        {@const Icon = topicIconForLine(item.text)}
        {@const stripe = topicThumbKeywordUrl(item.text)}
        <article class="inf-focus__card">
          <div
            class="inf-focus__stripe"
            style:background-image="linear-gradient(90deg, color-mix(in srgb, var(--inf-focus-stripe-fallback, #1a1a1a) 55%, transparent), transparent), url({stripe})"
            aria-hidden="true"
          ></div>
          <div class="inf-focus__body">
            <div class="inf-focus__row">
              <span class="inf-focus__ico" aria-hidden="true">
                <svelte:component this={Icon} size={18} weight="light" />
              </span>
              <p class="inf-focus__text">{item.text}</p>
            </div>
            <span
              class="inf-focus__chip"
              class:inf-focus__chip--need={item.kind === 'need'}
              class:inf-focus__chip--interest={item.kind === 'interest'}
            >
              {item.kind === 'interest' ? 'Interest' : 'Need'}
            </span>
          </div>
        </article>
      {/each}
    </div>
  </div>
{/if}

<style>
  .inf-focus {
    margin-top: 14px;
  }

  .inf-focus[data-variant='home'] {
    --inf-focus-text: color-mix(in srgb, var(--inf-soft, #e4e4e7) 92%, #fff);
    --inf-focus-muted: var(--inf-muted, #a1a1aa);
    --inf-focus-border: var(--inf-border, rgba(255, 255, 255, 0.1));
    --inf-focus-surface: color-mix(in srgb, var(--panel-surface, #18181b) 55%, transparent);
    --inf-focus-stripe-fallback: #27272a;
    --inf-focus-chip-bg: rgba(255, 255, 255, 0.06);
    --inf-focus-chip-need: rgba(180, 120, 60, 0.25);
    --inf-focus-chip-int: rgba(120, 140, 255, 0.2);
  }

  .inf-focus[data-variant='default'] {
    --inf-focus-text: #18181b;
    --inf-focus-muted: #71717a;
    --inf-focus-border: #e4e4e7;
    --inf-focus-surface: #fff;
    --inf-focus-stripe-fallback: #f4f4f5;
    --inf-focus-chip-bg: #f4f4f5;
    --inf-focus-chip-need: #fef3c7;
    --inf-focus-chip-int: #e0e7ff;
  }

  .inf-focus__kicker {
    margin: 0 0 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--inf-focus-muted);
  }

  .inf-focus__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  @media (min-width: 420px) {
    .inf-focus__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 720px) {
    .inf-focus__grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .inf-focus__card {
    display: flex;
    min-height: 0;
    border-radius: 12px;
    border: 1px solid var(--inf-focus-border);
    background: var(--inf-focus-surface);
    overflow: hidden;
  }

  .inf-focus__stripe {
    flex: 0 0 44px;
    min-height: 72px;
    background-size: cover;
    background-position: center;
  }

  .inf-focus__body {
    flex: 1;
    min-width: 0;
    padding: 10px 10px 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: space-between;
  }

  .inf-focus__row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .inf-focus__ico {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--inf-focus-text);
    opacity: 0.9;
  }

  .inf-focus__text {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--inf-focus-text);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .inf-focus__chip {
    align-self: flex-start;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 999px;
    background: var(--inf-focus-chip-bg);
    color: var(--inf-focus-muted);
  }

  .inf-focus__chip--interest {
    background: var(--inf-focus-chip-int);
    color: var(--inf-focus-text);
  }

  .inf-focus__chip--need {
    background: var(--inf-focus-chip-need);
    color: var(--inf-focus-text);
  }
</style>
