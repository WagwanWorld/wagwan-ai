<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Clock from 'phosphor-svelte/lib/Clock';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';

  export let gcsUrl: string;
  export let mediaType: string;
  export let caption: string;
  export let hashtags: string[];
  export let scheduledAt: string;
  export let reasoning: string;
  export let status: string = 'draft';
  export let igPermalink: string = '';
  export let index: number = 0;

  const dispatch = createEventDispatcher();
  let editingCaption = false;
  let editedCaption = caption;
  let showReasoning = false;

  function saveCaption() {
    editingCaption = false;
    dispatch('update', { field: 'caption', value: editedCaption, index });
  }

  $: displayDate = scheduledAt ? new Date(scheduledAt).toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : 'No time set';

  $: statusColor = status === 'published' ? '#4ade80' : status === 'failed' ? '#fb7185' : status === 'scheduled' ? '#FFB84D' : 'var(--text-muted)';
</script>

<div class="post-card">
  <div class="post-thumb">
    {#if mediaType === 'IMAGE' || mediaType === 'CAROUSEL'}
      <img src={gcsUrl} alt="" />
    {:else}
      <div class="post-video-badge">{mediaType}</div>
    {/if}
    <span class="post-type-badge">{mediaType}</span>
  </div>

  <div class="post-body">
    <div class="post-meta">
      <Clock size={14} />
      <span>{displayDate}</span>
      <span class="post-status" style="color: {statusColor}">{status}</span>
    </div>

    {#if editingCaption}
      <textarea class="post-caption-edit" bind:value={editedCaption} on:blur={saveCaption} rows="3"></textarea>
    {:else}
      <p class="post-caption" on:click={() => { editingCaption = true; editedCaption = caption; }}>
        {caption || 'Click to add caption'}
        <PencilSimple size={12} class="edit-icon" />
      </p>
    {/if}

    {#if hashtags.length}
      <div class="post-hashtags">
        {#each hashtags as tag}
          <span class="hashtag">#{tag}</span>
        {/each}
      </div>
    {/if}

    {#if reasoning}
      <button class="reasoning-toggle" on:click={() => showReasoning = !showReasoning}>
        Why this time? <CaretDown size={12} />
      </button>
      {#if showReasoning}
        <p class="reasoning-text">{reasoning}</p>
      {/if}
    {/if}

    {#if igPermalink}
      <a href={igPermalink} target="_blank" rel="noopener" class="permalink">View on Instagram</a>
    {/if}
  </div>

  {#if status === 'draft' || status === 'scheduled'}
    <button class="post-delete" on:click={() => dispatch('delete', { index })} title="Remove">
      <Trash size={16} />
    </button>
  {/if}
</div>

<style>
  .post-card {
    display: flex; gap: 16px; padding: 16px;
    background: var(--panel-surface); border: 1px solid var(--panel-border);
    border-radius: 14px; position: relative;
  }
  .post-thumb {
    width: 80px; height: 80px; border-radius: 10px; overflow: hidden;
    flex-shrink: 0; position: relative;
  }
  .post-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .post-video-badge {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--glass-medium); font-size: 11px; font-weight: 700; color: var(--text-muted);
  }
  .post-type-badge {
    position: absolute; bottom: 4px; left: 4px;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px;
  }
  .post-body { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .post-meta {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--text-muted);
  }
  .post-status { font-weight: 700; text-transform: uppercase; font-size: 10px; }
  .post-caption {
    font-size: 13px; color: var(--text-primary); line-height: 1.5;
    margin: 0; cursor: pointer; display: flex; align-items: start; gap: 6px;
  }
  .post-caption-edit {
    width: 100%; font-size: 13px; font-family: inherit;
    background: var(--bg-elevated); border: 1px solid var(--border-subtle);
    border-radius: 8px; padding: 8px; color: var(--text-primary); resize: vertical;
  }
  :global(.edit-icon) { opacity: 0.3; flex-shrink: 0; margin-top: 3px; }
  .post-hashtags { display: flex; flex-wrap: wrap; gap: 4px; }
  .hashtag { font-size: 11px; color: var(--accent-secondary); font-weight: 600; }
  .reasoning-toggle {
    background: none; border: none; font-size: 11px; color: var(--text-muted);
    cursor: pointer; padding: 0; display: flex; align-items: center; gap: 4px;
    font-family: inherit;
  }
  .reasoning-text { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0; }
  .permalink { font-size: 12px; color: var(--accent-primary); text-decoration: none; }
  .post-delete {
    position: absolute; top: 12px; right: 12px;
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    padding: 4px; transition: color 0.15s;
  }
  .post-delete:hover { color: var(--accent-primary); }
</style>
