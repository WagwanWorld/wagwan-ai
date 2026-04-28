<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface UploadedAsset {
    gcsUrl: string;
    mediaType: string;
    fileName: string;
  }

  export let assets: UploadedAsset[] = [];

  const dispatch = createEventDispatcher<{
    scheduleAll: {
      assets: UploadedAsset[];
      cadence: { frequency: string; startDate: string; time: string; timezone: string };
    };
    editIndividual: void;
  }>();

  type Frequency = 'daily' | 'twice_daily' | 'every_2_days' | 'custom';
  let frequency: Frequency = 'daily';
  let startDate = new Date().toISOString().split('T')[0];
  let time = '09:00';
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const frequencyLabels: Record<Frequency, string> = {
    daily: '1/day',
    twice_daily: '2/day',
    every_2_days: 'Every 2 days',
    custom: 'Custom',
  };

  const intervalMs: Record<Frequency, number> = {
    daily: 86400000,
    twice_daily: 43200000,
    every_2_days: 172800000,
    custom: 86400000,
  };

  $: previewSlots = assets.map((asset, i) => {
    const base = new Date(`${startDate}T${time}:00`);
    const slotDate = new Date(base.getTime() + i * intervalMs[frequency]);
    return {
      asset,
      date: slotDate,
      dayLabel: slotDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() + ' ' + slotDate.getDate(),
      timeLabel: slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  });

  $: totalDays = assets.length > 0
    ? Math.ceil((assets.length * intervalMs[frequency]) / 86400000)
    : 0;

  function mediaIcon(type: string): string {
    if (type === 'VIDEO' || type === 'REELS') return '🎬';
    if (type === 'CAROUSEL') return '📱';
    return '📸';
  }

  function removeAsset(idx: number) {
    assets = assets.filter((_, i) => i !== idx);
  }

  function handleScheduleAll() {
    dispatch('scheduleAll', {
      assets,
      cadence: { frequency, startDate, time, timezone },
    });
  }
</script>

<div class="bcw">
  <!-- Asset strip -->
  <div class="bcw-card">
    <span class="bcw-label">DRAG TO REORDER · {assets.length} ASSETS</span>
    <div class="bcw-strip">
      {#each assets as asset, i}
        <div class="bcw-asset">
          <div class="bcw-asset-num">{i + 1}</div>
          <button class="bcw-asset-remove" on:click={() => removeAsset(i)}>✕</button>
          <div class="bcw-asset-thumb">{mediaIcon(asset.mediaType)}</div>
          <div class="bcw-asset-meta">
            <div class="bcw-asset-name">{asset.fileName}</div>
            <div class="bcw-asset-type">{asset.mediaType}</div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Cadence config -->
  <div class="bcw-card" style="margin-top: 12px;">
    <span class="bcw-label">SET CADENCE</span>
    <div class="bcw-config">
      <div class="bcw-field">
        <span class="bcw-field-label">FREQUENCY</span>
        <div class="bcw-pills">
          {#each Object.entries(frequencyLabels) as [key, label]}
            <button
              class="bcw-pill"
              class:bcw-pill--active={frequency === key}
              on:click={() => (frequency = key as Frequency)}
            >{label}</button>
          {/each}
        </div>
      </div>
      <div class="bcw-field">
        <span class="bcw-field-label">STARTING</span>
        <input type="date" class="bcw-input" bind:value={startDate} />
      </div>
      <div class="bcw-field">
        <span class="bcw-field-label">TIME</span>
        <input type="time" class="bcw-input" bind:value={time} />
      </div>
      <div class="bcw-field">
        <span class="bcw-field-label">TIMEZONE</span>
        <div class="bcw-input bcw-input--static">{timezone}</div>
      </div>
    </div>

    <!-- Preview timeline -->
    {#if assets.length > 0}
      <div class="bcw-preview">
        <span class="bcw-label bcw-label--accent">PREVIEW — {assets.length} POSTS OVER {totalDays} DAYS</span>
        <div class="bcw-timeline">
          {#each previewSlots as slot, i}
            {#if i > 0}<div class="bcw-connector"></div>{/if}
            <div class="bcw-slot">
              <div class="bcw-slot-day">{slot.dayLabel}</div>
              <div class="bcw-slot-thumb">{mediaIcon(slot.asset.mediaType)}</div>
              <div class="bcw-slot-time">{slot.timeLabel}</div>
            </div>
          {/each}
        </div>

        <div class="bcw-ai-note">
          <span>⚡</span>
          <span>AI will generate unique captions, hashtags, and mentions for each asset. Captions adapt based on post type.</span>
        </div>
      </div>
    {/if}

    <div class="bcw-actions">
      <button class="bcw-btn-ghost" on:click={() => dispatch('editIndividual')}>Edit Individual Posts</button>
      <button class="bcw-btn-primary" on:click={handleScheduleAll}>Generate & Schedule All</button>
    </div>
  </div>
</div>

<style>
  .bcw-card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px 16px; }
  .bcw-label { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #4a4a50; display: block; margin-bottom: 10px; }
  .bcw-label--accent { color: #e8464a; }

  .bcw-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
  .bcw-strip::-webkit-scrollbar { height: 3px; }
  .bcw-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
  .bcw-asset { flex-shrink: 0; width: 110px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.07); overflow: hidden; position: relative; cursor: grab; transition: all 0.15s; }
  .bcw-asset:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
  .bcw-asset-num { position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; border-radius: 50%; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 9px; font-weight: 700; color: #ededef; }
  .bcw-asset-remove { position: absolute; top: 6px; right: 6px; width: 16px; height: 16px; border-radius: 50%; background: rgba(248,113,113,0.2); border: none; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #f87171; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
  .bcw-asset:hover .bcw-asset-remove { opacity: 1; }
  .bcw-asset-thumb { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 24px; background: linear-gradient(135deg, #1a1a2e, #2a1a3e); }
  .bcw-asset-meta { padding: 6px 8px; background: rgba(0,0,0,0.3); }
  .bcw-asset-name { font-size: 10px; color: #8a8a90; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bcw-asset-type { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #4a4a50; margin-top: 2px; }

  .bcw-config { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
  .bcw-field { display: flex; flex-direction: column; gap: 5px; }
  .bcw-field-label { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #4a4a50; }
  .bcw-pills { display: flex; gap: 3px; background: rgba(255,255,255,0.025); border-radius: 8px; padding: 2px; }
  .bcw-pill { padding: 6px 12px; border-radius: 6px; border: none; font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; color: #4a4a50; background: transparent; transition: all 0.15s; }
  .bcw-pill--active { background: rgba(232,70,74,0.15); color: #e8464a; }
  .bcw-input { padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #ededef; font-family: 'Inter',sans-serif; font-size: 12px; }
  .bcw-input:focus { outline: none; border-color: rgba(232,70,74,0.3); }
  .bcw-input--static { color: #4a4a50; cursor: default; }

  .bcw-preview { margin-top: 14px; padding: 14px 16px; border-radius: 12px; background: rgba(232,70,74,0.02); border: 1px solid rgba(232,70,74,0.08); }
  .bcw-timeline { display: flex; align-items: flex-start; overflow-x: auto; padding-bottom: 4px; }
  .bcw-slot { display: flex; flex-direction: column; align-items: center; min-width: 80px; flex-shrink: 0; }
  .bcw-slot-day { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #4a4a50; margin-bottom: 6px; }
  .bcw-slot-thumb { width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid rgba(232,70,74,0.15); background: rgba(255,255,255,0.025); }
  .bcw-slot-time { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 9px; color: #e8464a; margin-top: 4px; }
  .bcw-connector { width: 20px; height: 1px; background: rgba(232,70,74,0.15); margin-top: 32px; flex-shrink: 0; }

  .bcw-ai-note { margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: rgba(127,200,169,0.03); border: 1px solid rgba(127,200,169,0.08); display: flex; gap: 10px; font-size: 12px; color: #7fc8a9; line-height: 1.5; }

  .bcw-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
  .bcw-btn-primary { padding: 8px 18px; border-radius: 8px; background: rgba(232,70,74,0.15); border: 1px solid rgba(232,70,74,0.25); color: #e8464a; font-size: 12px; font-weight: 600; cursor: pointer; }
  .bcw-btn-primary:hover { background: rgba(232,70,74,0.2); }
  .bcw-btn-ghost { padding: 8px 18px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); color: #8a8a90; font-size: 12px; font-weight: 500; cursor: pointer; }
  .bcw-btn-ghost:hover { background: rgba(255,255,255,0.06); }

  @media (max-width: 768px) {
    .bcw-config { flex-direction: column; }
  }
</style>
