<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface ActivityEvent {
    id: string;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string;
  }

  let events: ActivityEvent[] = [];
  let loading = true;
  let pollInterval: ReturnType<typeof setInterval>;

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  function eventLabel(e: ActivityEvent): string {
    const data = e.event_data;
    switch (e.event_type) {
      case 'uploaded': return `Asset uploaded`;
      case 'generated': return `AI content generated`;
      case 'scheduled': return `Post scheduled${data.cadence ? ` (${data.cadence})` : ''}`;
      case 'published': return `Published to Instagram`;
      case 'failed': return `Post failed: ${(data.error as string)?.slice(0, 60) || 'unknown error'}`;
      case 'retried': return `Post retried and published`;
      case 'rescheduled': return `Post rescheduled`;
      default: return e.event_type;
    }
  }

  function eventColor(type: string): string {
    switch (type) {
      case 'published':
      case 'retried': return '#7fc8a9';
      case 'failed': return '#f87171';
      case 'scheduled':
      case 'rescheduled': return '#e8464a';
      default: return '#4A4A50';
    }
  }

  async function loadEvents() {
    try {
      const res = await fetch('/api/brand/activity-feed?limit=30', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        events = data.events || [];
      }
    } catch {
      // Silently fail — feed is non-critical
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadEvents();
    pollInterval = setInterval(loadEvents, 30000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<aside class="ca-feed">
  <span class="ca-feed-label">ACTIVITY</span>
  {#if loading}
    <div class="ca-feed-empty">Loading...</div>
  {:else if events.length === 0}
    <div class="ca-feed-empty">No activity yet</div>
  {:else}
    <div class="ca-feed-list">
      {#each events as event}
        <div class="ca-feed-item">
          <div class="ca-feed-dot" style="background:{eventColor(event.event_type)}"></div>
          <div class="ca-feed-content">
            <span class="ca-feed-time">{formatTime(event.created_at)}</span>
            <span class="ca-feed-text">{eventLabel(event)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .ca-feed {
    width: 260px;
    border-left: 1px solid rgba(255, 255, 255, 0.05);
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .ca-feed-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
    display: block;
    margin-bottom: 12px;
  }
  .ca-feed-empty {
    font-size: 12px;
    color: #4a4a50;
  }
  .ca-feed-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ca-feed-item {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
    align-items: flex-start;
  }
  .ca-feed-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }
  .ca-feed-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .ca-feed-time {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #3a3a40;
    letter-spacing: 0.05em;
  }
  .ca-feed-text {
    font-size: 12px;
    color: #8a8a90;
    line-height: 1.4;
  }

  @media (max-width: 1024px) {
    .ca-feed {
      display: none;
    }
  }
</style>
