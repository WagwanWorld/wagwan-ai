<script lang="ts">
  export let reads: { title: string; author: string; type: string; why: string; url: string }[] = [];

  const typeEmoji: Record<string, string> = {
    book: '📚',
    article: '📄',
    podcast: '🎙️',
  };
</script>

{#if reads.length}
  <div class="reads-strip">
    {#each reads as item}
      <a class="read-card" href={item.url || '#'} target="_blank" rel="noopener">
        <span class="read-type">{typeEmoji[item.type] || '📖'} {item.type}</span>
        <h4 class="read-title">{item.title}</h4>
        {#if item.author}<span class="read-author">{item.author}</span>{/if}
        <p class="read-why">{item.why}</p>
      </a>
    {/each}
  </div>
{/if}

<style>
  .reads-strip {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .reads-strip::-webkit-scrollbar { display: none; }

  .read-card {
    flex-shrink: 0;
    width: 240px;
    padding: 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.15s, border-color 0.15s;
  }
  .read-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 184, 77, 0.3);
  }

  .read-type {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-tertiary, #FFB84D);
  }

  .read-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
  }

  .read-author {
    font-size: 11px;
    color: var(--text-muted);
  }

  .read-why {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin: 0;
    font-style: italic;
  }
</style>
