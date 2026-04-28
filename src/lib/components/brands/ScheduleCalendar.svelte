<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface ScheduledPost {
    id: string;
    gcs_url: string;
    media_type: string;
    caption: string;
    scheduled_at: string;
    status: string;
    error_message?: string;
  }

  export let posts: ScheduledPost[] = [];
  export let loading: boolean = false;

  const dispatch = createEventDispatcher<{
    editPost: { post: ScheduledPost };
    newPost: { date: string };
    reschedule: { postId: string; newDate: string };
    retry: { postId: string };
    refresh: void;
  }>();

  let viewMode: 'week' | 'month' = 'week';
  let anchorDate = new Date();

  $: weekStart = getWeekStart(anchorDate);
  $: weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  $: monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  $: monthGridStart = (() => {
    const d = new Date(monthStart);
    const day = d.getDay() || 7; // Mon = 1
    d.setDate(d.getDate() - (day - 1));
    return d;
  })();
  $: monthCells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(monthGridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getWeekStart(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay() || 7;
    result.setDate(result.getDate() - (day - 1));
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function postsForDate(date: Date): ScheduledPost[] {
    const dateStr = date.toISOString().split('T')[0];
    return posts.filter((p) => p.scheduled_at?.startsWith(dateStr));
  }

  function isToday(d: Date): boolean {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  function formatDay(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() +
      ' ' + d.getDate();
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function formatWeekRange(): string {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }

  function formatMonth(): string {
    return anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function navigate(dir: number) {
    const d = new Date(anchorDate);
    if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    anchorDate = d;
  }

  function statusClass(s: string): string {
    if (s === 'published') return 'posted';
    if (s === 'failed') return 'failed';
    return 'scheduled';
  }

  function statusLabel(s: string): string {
    if (s === 'published') return 'Posted ✓';
    if (s === 'failed') return 'Failed';
    if (s === 'publishing') return 'Publishing...';
    return 'Scheduled';
  }

  function mediaIcon(type: string): string {
    if (type === 'VIDEO' || type === 'REELS') return '🎬';
    if (type === 'CAROUSEL') return '📱';
    if (type === 'STORIES') return '📷';
    return '📸';
  }
</script>

<div class="cal bs-card">
  <!-- Toolbar -->
  <div class="cal-toolbar">
    <div class="cal-nav">
      <button class="cal-nav-btn" on:click={() => navigate(-1)}>←</button>
      <span class="cal-title">{viewMode === 'week' ? formatWeekRange() : formatMonth()}</span>
      <button class="cal-nav-btn" on:click={() => navigate(1)}>→</button>
    </div>
    <div class="cal-toggle">
      <button class="cal-toggle-btn" class:active={viewMode === 'week'} on:click={() => (viewMode = 'week')}>Week</button>
      <button class="cal-toggle-btn" class:active={viewMode === 'month'} on:click={() => (viewMode = 'month')}>Month</button>
    </div>
    <button class="cal-new-btn" on:click={() => dispatch('newPost', { date: new Date().toISOString().split('T')[0] })}>+ New Post</button>
  </div>

  {#if viewMode === 'week'}
    <div class="cal-week">
      {#each weekDays as day}
        <div
          class="cal-day"
          on:click={() => dispatch('newPost', { date: day.toISOString().split('T')[0] })}
          on:keydown={(e) => e.key === 'Enter' && dispatch('newPost', { date: day.toISOString().split('T')[0] })}
          role="button"
          tabindex="0"
        >
          <div class="cal-day-header" class:today={isToday(day)}>{formatDay(day)}{isToday(day) ? ' · Today' : ''}</div>
          {#if isToday(day)}<div class="cal-today-line"></div>{/if}
          {#each postsForDate(day) as post}
            <button
              class="cal-post cal-post--{statusClass(post.status)}"
              on:click|stopPropagation={() => dispatch('editPost', { post })}
            >
              <div class="cal-post-thumb">{mediaIcon(post.media_type)}</div>
              <div class="cal-post-time cal-post-time--{statusClass(post.status)}">{formatTime(post.scheduled_at)}</div>
              <div class="cal-post-caption">{post.caption?.slice(0, 40) || 'No caption'}</div>
              <div class="cal-post-badges">
                <span class="cal-badge cal-badge--{statusClass(post.status)}">{statusLabel(post.status)}</span>
                {#if post.status === 'failed'}
                  <button class="cal-retry" on:click|stopPropagation={() => dispatch('retry', { postId: post.id })}>↻ Retry</button>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <!-- Month view -->
    <div class="cal-month-header">
      {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as d}
        <div class="cal-month-day-label">{d}</div>
      {/each}
    </div>
    <div class="cal-month-grid">
      {#each monthCells as cell}
        <button
          class="cal-month-cell"
          class:cal-month-cell--other={cell.getMonth() !== anchorDate.getMonth()}
          on:click={() => { anchorDate = cell; viewMode = 'week'; }}
        >
          <div class="cal-month-num" class:today={isToday(cell)}>{cell.getDate()}</div>
          <div class="cal-month-dots">
            {#each postsForDate(cell) as post}
              <div class="cal-dot cal-dot--{statusClass(post.status)}"></div>
            {/each}
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="cal-legend">
    <div class="cal-legend-item"><div class="cal-legend-dot cal-dot--scheduled"></div> Scheduled</div>
    <div class="cal-legend-item"><div class="cal-legend-dot cal-dot--posted"></div> Posted</div>
    <div class="cal-legend-item"><div class="cal-legend-dot cal-dot--failed"></div> Failed</div>
  </div>
</div>

<style>
  .cal { padding: 0; }
  .bs-card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }

  .cal-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .cal-nav { display: flex; align-items: center; gap: 8px; }
  .cal-nav-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; color: #4a4a50; padding: 5px 9px; font-size: 11px; cursor: pointer; }
  .cal-nav-btn:hover { background: rgba(255,255,255,0.06); color: #8a8a90; }
  .cal-title { font-size: 14px; font-weight: 600; color: #ededef; }
  .cal-toggle { display: flex; gap: 2px; background: rgba(255,255,255,0.025); border-radius: 8px; padding: 2px; }
  .cal-toggle-btn { padding: 5px 14px; border-radius: 6px; border: none; font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; color: #4a4a50; background: transparent; }
  .cal-toggle-btn.active { background: rgba(232,70,74,0.15); color: #e8464a; }
  .cal-new-btn { padding: 7px 16px; border-radius: 8px; background: rgba(232,70,74,0.15); border: 1px solid rgba(232,70,74,0.25); color: #e8464a; font-size: 11px; font-weight: 600; cursor: pointer; }
  .cal-new-btn:hover { background: rgba(232,70,74,0.2); }

  .cal-week { display: grid; grid-template-columns: repeat(7, 1fr); min-height: 380px; }
  .cal-day { border-right: 1px solid rgba(255,255,255,0.03); padding: 10px; cursor: pointer; }
  .cal-day:last-child { border-right: none; }
  .cal-day:hover { background: rgba(255,255,255,0.01); }
  .cal-day-header { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #4a4a50; margin-bottom: 8px; }
  .cal-day-header.today { color: #e8464a; }
  .cal-today-line { height: 2px; background: #e8464a; border-radius: 1px; margin-bottom: 8px; }

  .cal-post { display: block; width: 100%; text-align: left; border-radius: 10px; padding: 8px; margin-bottom: 6px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
  .cal-post:hover { transform: translateY(-1px); }
  .cal-post--scheduled { background: rgba(232,70,74,0.04); border-color: rgba(232,70,74,0.12); }
  .cal-post--posted { background: rgba(127,200,169,0.04); border-color: rgba(127,200,169,0.12); }
  .cal-post--failed { background: rgba(248,113,113,0.04); border-color: rgba(248,113,113,0.12); }
  .cal-post-thumb { font-size: 18px; margin-bottom: 4px; }
  .cal-post-time { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; }
  .cal-post-time--scheduled { color: #e8464a; }
  .cal-post-time--posted { color: #7fc8a9; }
  .cal-post-time--failed { color: #f87171; }
  .cal-post-caption { font-size: 11px; color: #8a8a90; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cal-post-badges { display: flex; gap: 3px; margin-top: 4px; align-items: center; }
  .cal-badge { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 6px; border-radius: 4px; }
  .cal-badge--scheduled { background: rgba(232,70,74,0.1); color: #e8464a; }
  .cal-badge--posted { background: rgba(127,200,169,0.1); color: #7fc8a9; }
  .cal-badge--failed { background: rgba(248,113,113,0.1); color: #f87171; }
  .cal-retry { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 8px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #8a8a90; border: none; cursor: pointer; }

  .cal-month-header { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid rgba(255,255,255,0.04); }
  .cal-month-day-label { padding: 8px; text-align: center; font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #4a4a50; background: rgba(0,0,0,0.15); }
  .cal-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
  .cal-month-cell { padding: 8px; min-height: 72px; border-right: 1px solid rgba(255,255,255,0.025); border-bottom: 1px solid rgba(255,255,255,0.025); cursor: pointer; background: transparent; border-top: none; border-left: none; text-align: left; }
  .cal-month-cell:nth-child(7n) { border-right: none; }
  .cal-month-cell:hover { background: rgba(255,255,255,0.015); }
  .cal-month-cell--other { opacity: 0.3; }
  .cal-month-num { font-size: 11px; color: #4a4a50; margin-bottom: 4px; }
  .cal-month-num.today { color: #e8464a; font-weight: 600; }
  .cal-month-dots { display: flex; gap: 3px; flex-wrap: wrap; }
  .cal-dot { width: 7px; height: 7px; border-radius: 2px; }
  .cal-dot--scheduled { background: #e8464a; }
  .cal-dot--posted { background: #7fc8a9; }
  .cal-dot--failed { background: #f87171; }

  .cal-legend { display: flex; gap: 16px; padding: 10px 18px; border-top: 1px solid rgba(255,255,255,0.04); }
  .cal-legend-item { display: flex; align-items: center; gap: 5px; font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 9px; font-weight: 500; letter-spacing: 0.05em; color: #4a4a50; }
  .cal-legend-dot { width: 7px; height: 7px; border-radius: 2px; }

  @media (max-width: 768px) {
    .cal-week { grid-template-columns: 1fr; }
    .cal-day { min-height: auto; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.03); }
  }
</style>
