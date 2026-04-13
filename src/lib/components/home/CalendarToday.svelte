<script lang="ts">
  export let events: { title: string; start: string; end?: string }[] = [];

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ''; }
  }

  const colors = ['#4D7CFF', '#FFB84D', '#FF4D4D', '#4D7CFF', '#FFB84D'];
</script>

{#if events.length}
  <div class="cal-strip">
    {#each events.slice(0, 4) as event, i}
      <div class="cal-event" style="border-left-color: {colors[i % colors.length]}">
        <span class="cal-time">{formatTime(event.start)}</span>
        <span class="cal-title">{event.title}</span>
      </div>
    {/each}
  </div>
{:else}
  <p class="cal-empty">No events today</p>
{/if}

<style>
  .cal-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .cal-strip::-webkit-scrollbar { display: none; }

  .cal-event {
    flex-shrink: 0;
    width: 200px;
    padding: 12px 14px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid #4D7CFF;
    border-radius: 12px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
  }

  .cal-time {
    display: block;
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .cal-title {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cal-empty {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    padding: 0 24px;
  }
</style>
