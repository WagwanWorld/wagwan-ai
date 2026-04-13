<script lang="ts">
  export let news: { headline: string; summary: string; source: string; url: string; relevance: string }[] = [];
</script>

{#if news.length}
  <div class="brief-list">
    {#each news as item}
      <a class="brief-card" href={item.url} target="_blank" rel="noopener">
        <div class="brief-top">
          <span class="brief-source">{item.source}</span>
          <span class="brief-relevance">{item.relevance}</span>
        </div>
        <h4 class="brief-headline">{item.headline}</h4>
        <p class="brief-summary">{item.summary}</p>
      </a>
    {/each}
  </div>
{/if}

<style>
  .brief-list { display: flex; flex-direction: column; gap: 12px; }

  .brief-card {
    display: block;
    padding: 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
    text-decoration: none;
    transition: transform 0.15s, border-color 0.15s;
  }
  .brief-card:hover {
    transform: translateY(-2px);
    border-color: rgba(77, 124, 255, 0.3);
  }

  .brief-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
    gap: 8px;
  }

  .brief-source {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-secondary, #4D7CFF);
  }

  .brief-relevance {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    text-align: right;
    flex-shrink: 1;
    min-width: 0;
  }

  .brief-headline {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px;
    line-height: 1.3;
  }

  .brief-summary {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }
</style>
