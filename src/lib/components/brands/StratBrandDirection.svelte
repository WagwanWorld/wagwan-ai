<script lang="ts">
  export let brandDirection: string = '';
  export let audienceSummary: string = '';
  export let competitiveEdge: string = '';
  export let quickWins: string[] = [];
  export let brandIdentity: {
    aesthetic?: string;
    lifestyle?: string;
    brandVibes?: string[];
    interests?: string[];
    captionIntent?: string;
  } | null = null;
</script>

<div class="direction">
  {#if brandDirection}
    <p class="direction-quote">{brandDirection}</p>
  {/if}

  <div class="direction-grid">
    <div class="direction-col">
      {#if audienceSummary}
        <div class="block">
          <span class="label">Your Audience</span>
          <p class="body">{audienceSummary}</p>
        </div>
      {/if}

      {#if competitiveEdge}
        <div class="block">
          <span class="label">Competitive Edge</span>
          <p class="body">{competitiveEdge}</p>
        </div>
      {/if}
    </div>

    {#if brandIdentity}
      <div class="direction-col">
        <div class="block">
          <span class="label">Brand DNA</span>
          <div class="tags">
            {#if brandIdentity.aesthetic}
              <span class="tag">{brandIdentity.aesthetic}</span>
            {/if}
            {#if brandIdentity.lifestyle}
              <span class="tag">{brandIdentity.lifestyle}</span>
            {/if}
            {#each (brandIdentity.brandVibes || []).slice(0, 3) as vibe}
              <span class="tag">{vibe}</span>
            {/each}
            {#if brandIdentity.captionIntent}
              <span class="tag">{brandIdentity.captionIntent}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if quickWins.length > 0}
    <div class="wins">
      <span class="label wins-label">Quick Wins</span>
      <ol class="wins-list">
        {#each quickWins as win}
          <li class="win-item">{win}</li>
        {/each}
      </ol>
    </div>
  {/if}
</div>

<style>
  .direction {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .direction-quote {
    font-size: 15px;
    font-weight: 400;
    line-height: 1.65;
    color: var(--g-text-2);
    margin: 0;
    padding-left: 16px;
    border-left: 2px solid rgba(255,255,255,0.06);
  }

  .label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }

  .direction-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .direction-col {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .body {
    font-size: 14px;
    color: var(--g-text-3);
    line-height: 1.7;
    margin: 0;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .tag {
    font-size: 10px;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    color: var(--g-text-4);
    border: 1px solid rgba(255,255,255,0.02);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .wins {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid rgba(255,255,255,0.03);
    padding-top: 18px;
  }

  .wins-label {
    color: var(--g-accent, rgba(255,64,64,0.6));
  }

  .wins-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .win-item {
    font-size: 14px;
    color: var(--g-text-3);
    line-height: 1.7;
  }

  .win-item::marker {
    color: var(--g-text-ghost);
  }

  @media (max-width: 700px) {
    .direction-grid { grid-template-columns: 1fr; gap: 20px; }
  }
</style>
