<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let asset: {
    gcsUrl: string;
    mediaType: string;
    fileName?: string;
    caption: string;
    hashtags: string[];
    mentions: string[];
    location: string;
    altText: string;
    postType: string;
  };
  export let index: number = 0;
  export let total: number = 1;

  const dispatch = createEventDispatcher<{
    schedule: { asset: typeof asset; scheduledAt: string };
    regenerate: { index: number };
    publishNow: { asset: typeof asset };
  }>();

  let editCaption = asset.caption;
  let editHashtags = [...asset.hashtags];
  let editMentions = [...asset.mentions];
  let editLocation = asset.location;
  let editPostType = asset.postType;
  let scheduleDate = new Date().toISOString().split('T')[0];
  let scheduleTime = '09:00';
  let newHashtag = '';
  let newMention = '';

  $: charCount = editCaption.length;

  function removeHashtag(idx: number) {
    editHashtags = editHashtags.filter((_, i) => i !== idx);
  }
  function addHashtag() {
    if (newHashtag.trim()) {
      editHashtags = [...editHashtags, newHashtag.trim().replace(/^#/, '')];
      newHashtag = '';
    }
  }
  function removeMention(idx: number) {
    editMentions = editMentions.filter((_, i) => i !== idx);
  }
  function addMention() {
    if (newMention.trim()) {
      editMentions = [...editMentions, newMention.trim().replace(/^@/, '')];
      newMention = '';
    }
  }

  function handleSchedule() {
    const updated = {
      ...asset,
      caption: editCaption,
      hashtags: editHashtags,
      mentions: editMentions,
      location: editLocation,
      postType: editPostType,
    };
    dispatch('schedule', { asset: updated, scheduledAt: `${scheduleDate}T${scheduleTime}:00` });
  }
</script>

<div class="prc">
  <!-- Header -->
  <div class="prc-header">
    <span class="prc-label">REVIEW — POST {index + 1} OF {total}</span>
    <div class="prc-dots">
      {#each Array(total) as _, i}
        <span class="prc-dot" class:prc-dot--active={i === index}></span>
      {/each}
    </div>
  </div>

  <div class="prc-body">
    <!-- Media preview -->
    <div class="prc-media">
      <div class="prc-preview">
        {#if asset.mediaType === 'IMAGE' || asset.mediaType === 'CAROUSEL'}
          <img src={asset.gcsUrl} alt={asset.altText || 'Preview'} class="prc-img" />
        {:else}
          <div class="prc-video-placeholder">&#127916; Video</div>
        {/if}
      </div>
      <div class="prc-type-pills">
        {#each ['IMAGE', 'STORIES', 'REELS', 'CAROUSEL'] as t}
          <button
            class="prc-type-pill"
            class:prc-type-pill--active={editPostType === t}
            on:click={() => (editPostType = t)}
          >{t === 'IMAGE' ? 'Post' : t === 'STORIES' ? 'Story' : t === 'REELS' ? 'Reel' : 'Carousel'}</button>
        {/each}
      </div>
    </div>

    <!-- Fields -->
    <div class="prc-fields">
      <!-- Caption -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">CAPTION</span>
          <span class="prc-field-meta">AI GENERATED · {charCount} / 2,200</span>
        </div>
        <textarea class="prc-caption" bind:value={editCaption} rows="4" maxlength="2200"></textarea>
      </div>

      <!-- Hashtags -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">HASHTAGS</span>
          <span class="prc-field-meta">{editHashtags.length} TAGS</span>
        </div>
        <div class="prc-tags">
          {#each editHashtags as tag, i}
            <button class="prc-tag prc-tag--blue" on:click={() => removeHashtag(i)}>#{tag} ×</button>
          {/each}
          <form class="prc-tag-add" on:submit|preventDefault={addHashtag}>
            <input class="prc-tag-input" bind:value={newHashtag} placeholder="+ add" />
          </form>
        </div>
      </div>

      <!-- Mentions -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">MENTIONS</span>
        </div>
        <div class="prc-tags">
          {#each editMentions as mention, i}
            <button class="prc-tag prc-tag--purple" on:click={() => removeMention(i)}>@{mention} ×</button>
          {/each}
          <form class="prc-tag-add" on:submit|preventDefault={addMention}>
            <input class="prc-tag-input" bind:value={newMention} placeholder="+ add" />
          </form>
        </div>
      </div>

      <!-- Location -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">LOCATION</span>
        </div>
        <input class="prc-location-input" bind:value={editLocation} placeholder="Location..." />
      </div>

      <!-- Schedule -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">SCHEDULE</span>
        </div>
        <div class="prc-schedule-row">
          <input type="date" class="prc-schedule-input" bind:value={scheduleDate} />
          <input type="time" class="prc-schedule-input" bind:value={scheduleTime} />
        </div>
      </div>

      <!-- Actions -->
      <div class="prc-actions">
        <button class="prc-btn-primary" on:click={handleSchedule}>Schedule Post</button>
        <button class="prc-btn-ghost" on:click={() => dispatch('regenerate', { index })}>Regenerate &#8635;</button>
        <button class="prc-btn-ghost" on:click={() => dispatch('publishNow', { asset: { ...asset, caption: editCaption, hashtags: editHashtags, mentions: editMentions, location: editLocation, postType: editPostType } })}>Publish Now</button>
      </div>
    </div>
  </div>
</div>

<style>
  .prc {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    overflow: hidden;
  }
  .prc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .prc-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: #4a4a50;
  }
  .prc-dots { display: flex; gap: 6px; }
  .prc-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.1); }
  .prc-dot--active { background: #e8464a; }

  .prc-body { display: flex; }

  .prc-media {
    width: 260px; padding: 18px;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    display: flex; flex-direction: column; gap: 10px;
  }
  .prc-preview {
    width: 100%; aspect-ratio: 4/5; border-radius: 10px; overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
  }
  .prc-img { width: 100%; height: 100%; object-fit: cover; }
  .prc-video-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    font-size: 24px; color: #4a4a50; background: linear-gradient(135deg, #1a1a2e, #2a1a3e);
  }
  .prc-type-pills { display: flex; gap: 4px; }
  .prc-type-pill {
    padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.04); color: #4a4a50;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
    text-transform: uppercase; cursor: pointer; transition: all 0.15s;
  }
  .prc-type-pill--active {
    background: rgba(232, 70, 74, 0.15); color: #e8464a;
    border-color: rgba(232, 70, 74, 0.2);
  }

  .prc-fields { flex: 1; padding: 18px; display: flex; flex-direction: column; gap: 14px; }

  .prc-field-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
  .prc-field-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: #4a4a50;
  }
  .prc-field-meta {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px; color: #3a3a40; letter-spacing: 0.05em;
  }
  .prc-caption {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.06);
    color: #9a9aa0; font-size: 13px; line-height: 1.6;
    font-family: 'Inter', sans-serif; resize: vertical;
  }
  .prc-caption:focus { outline: none; border-color: rgba(232, 70, 74, 0.3); }

  .prc-tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .prc-tag {
    padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;
    cursor: pointer; border: none; transition: opacity 0.15s;
  }
  .prc-tag:hover { opacity: 0.7; }
  .prc-tag--blue { background: rgba(123, 167, 217, 0.1); color: #7ba7d9; }
  .prc-tag--purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
  .prc-tag-add { display: inline; }
  .prc-tag-input {
    width: 60px; padding: 3px 8px; border-radius: 4px;
    background: rgba(255, 255, 255, 0.04); border: 1px dashed rgba(255, 255, 255, 0.08);
    color: #4a4a50; font-size: 10px; font-family: 'Inter', sans-serif;
  }
  .prc-tag-input:focus { outline: none; border-color: rgba(232, 70, 74, 0.3); }

  .prc-location-input {
    padding: 7px 12px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ededef; font-size: 12px; font-family: 'Inter', sans-serif; width: 200px;
  }
  .prc-location-input:focus { outline: none; border-color: rgba(232, 70, 74, 0.3); }

  .prc-schedule-row { display: flex; gap: 8px; }
  .prc-schedule-input {
    padding: 7px 12px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ededef; font-size: 12px; font-family: 'Inter', sans-serif;
  }
  .prc-schedule-input:focus { outline: none; border-color: rgba(232, 70, 74, 0.3); }

  .prc-actions { display: flex; gap: 8px; margin-top: 4px; }
  .prc-btn-primary {
    padding: 8px 18px; border-radius: 8px;
    background: rgba(232, 70, 74, 0.15); border: 1px solid rgba(232, 70, 74, 0.25);
    color: #e8464a; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .prc-btn-primary:hover { background: rgba(232, 70, 74, 0.2); }
  .prc-btn-ghost {
    padding: 8px 18px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .prc-btn-ghost:hover { background: rgba(255, 255, 255, 0.06); }

  @media (max-width: 768px) {
    .prc-body { flex-direction: column; }
    .prc-media { width: 100%; border-right: none; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
  }
</style>
