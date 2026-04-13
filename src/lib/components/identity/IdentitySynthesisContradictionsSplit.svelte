<script lang="ts">
  import { splitContradiction } from '$lib/identity/visualIdentity';

  export let lines: string[];
</script>

<section class="iv-block" aria-labelledby="iv-contra-h">
  <h3 id="iv-contra-h" class="iv-block__h">Contradictions</h3>
  <div class="iv-contra-list">
    {#each lines as line}
      {@const pair = splitContradiction(line)}
      {#if pair}
        <div class="iv-contra-card">
          <div class="iv-contra-half">
            <p class="iv-contra-tag">You appear as…</p>
            <p class="iv-contra-text">{pair.left}</p>
          </div>
          <div class="iv-contra-half iv-contra-half--accent">
            <p class="iv-contra-tag">But actually…</p>
            <p class="iv-contra-text">{pair.right}</p>
          </div>
        </div>
      {:else}
        <div class="iv-contra-fallback">
          <p class="iv-contra-text">{line}</p>
        </div>
      {/if}
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

  .iv-contra-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .iv-contra-card {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.1));
  }

  @media (min-width: 560px) {
    .iv-contra-card {
      grid-template-columns: 1fr 1fr;
    }
  }

  .iv-contra-half {
    padding: 14px 16px;
    background: var(--iv-surface-2, #fff);
  }

  .iv-contra-half--accent {
    background: color-mix(in srgb, #f0e8dc 75%, #fff);
    border-top: 1px solid var(--iv-border, rgba(0, 0, 0, 0.06));
  }

  @media (min-width: 560px) {
    .iv-contra-half--accent {
      border-top: none;
      border-left: 1px solid var(--iv-border, rgba(0, 0, 0, 0.06));
    }
  }

  .iv-contra-tag {
    margin: 0 0 0.4rem;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-contra-text {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--iv-text, #14120f);
  }

  .iv-contra-fallback {
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px dashed rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.5);
  }
</style>
