<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CloudArrowUp from 'phosphor-svelte/lib/CloudArrowUp';
  import ImageSquare from 'phosphor-svelte/lib/ImageSquare';
  import VideoCamera from 'phosphor-svelte/lib/VideoCamera';
  import FilmReel from 'phosphor-svelte/lib/FilmReel';
  import ClockCountdown from 'phosphor-svelte/lib/ClockCountdown';
  import Trash from 'phosphor-svelte/lib/Trash';
  import Images from 'phosphor-svelte/lib/Images';

  const dispatch = createEventDispatcher();
  let dragging = false;
  let uploading = false;
  let fileInput: HTMLInputElement;

  export let uploads: Array<{
    url: string;
    mediaType: string;
    postType: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';
    fileName: string;
  }> = [];

  const postTypes = [
    { id: 'IMAGE' as const, label: 'Feed Post', icon: ImageSquare, size: '1080 × 1080', ratio: '1:1' },
    { id: 'REELS' as const, label: 'Reel', icon: FilmReel, size: '1080 × 1920', ratio: '9:16' },
    { id: 'STORIES' as const, label: 'Story', icon: ClockCountdown, size: '1080 × 1920', ratio: '9:16' },
    { id: 'CAROUSEL' as const, label: 'Carousel', icon: Images, size: '1080 × 1080', ratio: '1:1' },
    { id: 'VIDEO' as const, label: 'Video Post', icon: VideoCamera, size: '1080 × 1080', ratio: '1:1 or 16:9' },
  ];

  let selectedType: typeof postTypes[number] | null = null;

  function selectType(type: typeof postTypes[number]) {
    selectedType = type;
  }

  async function handleFiles(files: FileList | File[]) {
    if (!selectedType) return;
    uploading = true;
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/brand/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        const newUploads = data.uploads.map((u: { url: string; mediaType: string; gcsPath: string }, i: number) => ({
          url: u.url,
          mediaType: u.mediaType,
          postType: selectedType!.id,
          fileName: (files instanceof FileList ? files[i] : files[i])?.name || 'file',
        }));
        uploads = [...uploads, ...newUploads];
        dispatch('uploaded', { uploads });
      }
      if (data.errors?.length) {
        dispatch('error', { errors: data.errors });
      }
    } catch {
      dispatch('error', { errors: [{ file: 'upload', error: 'Network error' }] });
    } finally {
      uploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    dragging = false;
    if (e.dataTransfer?.files && selectedType) handleFiles(e.dataTransfer.files);
  }

  function removeUpload(index: number) {
    uploads = uploads.filter((_, i) => i !== index);
    dispatch('uploaded', { uploads });
  }

  function resetType() {
    selectedType = null;
  }

  $: acceptTypes = selectedType?.id === 'REELS' || selectedType?.id === 'VIDEO'
    ? 'video/mp4'
    : selectedType?.id === 'STORIES'
      ? 'image/jpeg,video/mp4'
      : 'image/jpeg';

  $: previewRatio = selectedType?.id === 'REELS' || selectedType?.id === 'STORIES'
    ? '9 / 16'
    : '1 / 1';
</script>

<div class="upload-wrapper">
  {#if !selectedType}
    <!-- Step 1: Pick post type -->
    <div class="type-picker">
      <p class="picker-label">What are you posting?</p>
      <div class="type-grid">
        {#each postTypes as type}
          <button class="type-card" on:click={() => selectType(type)}>
            <svelte:component this={type.icon} size={24} weight="duotone" />
            <span class="type-name">{type.label}</span>
            <span class="type-size">{type.size}</span>
            <span class="type-ratio">{type.ratio}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Step 2: Upload with type selected -->
    <div class="type-selected-bar">
      <div class="type-selected-info">
        <svelte:component this={selectedType.icon} size={18} weight="duotone" />
        <span class="type-selected-label">{selectedType.label}</span>
        <span class="type-selected-size">{selectedType.size} ({selectedType.ratio})</span>
      </div>
      <button class="type-change-btn" on:click={resetType}>Change</button>
    </div>

    {#if uploads.length === 0}
      <div
        class="upload-zone"
        class:dragging
        on:dragover|preventDefault={() => dragging = true}
        on:dragleave={() => dragging = false}
        on:drop|preventDefault={onDrop}
        role="button"
        tabindex="0"
        on:click={() => fileInput.click()}
        on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
      >
        <input
          type="file"
          accept={acceptTypes}
          multiple={selectedType.id === 'CAROUSEL'}
          bind:this={fileInput}
          on:change={(e) => e.currentTarget.files && handleFiles(e.currentTarget.files)}
          style="display:none"
        />

        {#if uploading}
          <p class="upload-label">Uploading...</p>
        {:else}
          <CloudArrowUp size={32} weight="light" />
          <p class="upload-label">Drop your {selectedType.label.toLowerCase()} creative here</p>
          <p class="upload-hint">
            {#if selectedType.id === 'REELS' || selectedType.id === 'VIDEO'}
              MP4 video, max 100MB
            {:else if selectedType.id === 'STORIES'}
              JPEG image or MP4 video
            {:else if selectedType.id === 'CAROUSEL'}
              JPEG images, select multiple. Max 10.
            {:else}
              JPEG image, max 8MB
            {/if}
            — Recommended: {selectedType.size}
          </p>
        {/if}
      </div>
    {:else}
      <!-- Preview grid -->
      <div class="preview-grid">
        {#each uploads as u, i}
          <div class="preview-card">
            <div class="preview-frame" style="aspect-ratio: {previewRatio}">
              {#if u.mediaType === 'IMAGE'}
                <img src={u.url} alt={u.fileName} class="preview-img" />
              {:else}
                <video src={u.url} class="preview-img" muted playsinline>
                  <track kind="captions" />
                </video>
              {/if}
              <span class="preview-type-badge">{u.postType}</span>
              <button class="preview-remove" on:click={() => removeUpload(i)} title="Remove">
                <Trash size={14} />
              </button>
            </div>
            <p class="preview-name">{u.fileName}</p>
          </div>
        {/each}

        {#if selectedType.id === 'CAROUSEL' && uploads.length < 10}
          <div
            class="preview-add"
            style="aspect-ratio: {previewRatio}"
            role="button"
            tabindex="0"
            on:click={() => fileInput.click()}
            on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
          >
            <input
              type="file"
              accept={acceptTypes}
              multiple
              bind:this={fileInput}
              on:change={(e) => e.currentTarget.files && handleFiles(e.currentTarget.files)}
              style="display:none"
            />
            <span>+ Add more</span>
          </div>
        {/if}
      </div>

      <div class="preview-meta">
        <span class="preview-count">{uploads.length} file{uploads.length > 1 ? 's' : ''} ready</span>
        <span class="preview-rec">Recommended: {selectedType.size}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .upload-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── Type picker ── */
  .picker-label {
    font-size: 15px; font-weight: 700; color: var(--g-text, #EDEDEF);
    margin: 0 0 12px; text-align: center;
  }
  .type-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .type-card {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 20px 12px; border-radius: 16px;
    background: var(--g-surface, #17171A); border: 1px solid var(--g-border, rgba(255,255,255,0.06));
    color: var(--g-text-3, #4A4A50); cursor: pointer;
    transition: all 0.2s; font-family: inherit;
  }
  .type-card:hover {
    border-color: var(--g-accent, #E8464A);
    color: var(--g-text, #EDEDEF);
    background: var(--panel-hover);
  }
  .type-name { font-size: 13px; font-weight: 700; color: var(--g-text, #EDEDEF); }
  .type-size { font-size: 11px; color: var(--g-text-3, #4A4A50); }
  .type-ratio { font-size: 10px; color: var(--g-metric-reach, #E8833A); font-weight: 600; }

  /* ── Selected type bar ── */
  .type-selected-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; border-radius: 16px;
    background: var(--g-surface, #17171A); border: 1px solid var(--g-border, rgba(255,255,255,0.06));
  }
  .type-selected-info {
    display: flex; align-items: center; gap: 8px;
    color: var(--g-accent, #E8464A);
  }
  .type-selected-label { font-size: 14px; font-weight: 700; color: var(--g-text, #EDEDEF); }
  .type-selected-size { font-size: 12px; color: var(--g-text-3, #4A4A50); }
  .type-change-btn {
    background: none; border: none; font-size: 12px; font-weight: 600;
    color: var(--g-metric-reach, #E8833A); cursor: pointer; font-family: inherit;
    text-decoration: underline;
  }

  /* ── Upload zone ── */
  .upload-zone {
    border: 2px dashed var(--g-border, rgba(255,255,255,0.06));
    border-radius: 16px;
    padding: 40px 32px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--g-text-3, #4A4A50);
  }
  .upload-zone:hover, .upload-zone.dragging {
    border-color: var(--g-accent, #E8464A);
    background: var(--panel-surface-soft);
  }
  .upload-label { font-size: 14px; font-weight: 600; color: var(--g-text-2, #8A8A90); margin: 0; }
  .upload-hint { font-size: 12px; color: var(--g-text-3, #4A4A50); margin: 0; line-height: 1.5; }

  /* ── Preview grid ── */
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  .preview-card {
    display: flex; flex-direction: column; gap: 6px;
  }
  .preview-frame {
    position: relative; border-radius: 16px; overflow: hidden;
    background: var(--g-surface, #17171A); border: 1px solid var(--g-border, rgba(255,255,255,0.06));
  }
  .preview-img {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .preview-type-badge {
    position: absolute; top: 6px; left: 6px;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    background: rgba(0, 0, 0, 0.6); color: white;
    padding: 2px 8px; border-radius: 6px;
  }
  .preview-remove {
    position: absolute; top: 6px; right: 6px;
    background: rgba(0, 0, 0, 0.6); border: none;
    color: white; cursor: pointer; padding: 4px;
    border-radius: 6px; display: flex;
    opacity: 0; transition: opacity 0.15s;
  }
  .preview-frame:hover .preview-remove { opacity: 1; }
  .preview-name {
    font-size: 11px; color: var(--g-text-3, #4A4A50); margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .preview-add {
    display: flex; align-items: center; justify-content: center;
    border: 2px dashed var(--g-border, rgba(255,255,255,0.06)); border-radius: 16px;
    color: var(--g-text-3, #4A4A50); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: border-color 0.2s;
  }
  .preview-add:hover { border-color: var(--g-accent, #E8464A); }

  .preview-meta {
    display: flex; justify-content: space-between; align-items: center;
  }
  .preview-count { font-size: 13px; font-weight: 600; color: var(--g-text, #EDEDEF); }
  .preview-rec { font-size: 11px; color: var(--g-text-3, #4A4A50); }

  @media (max-width: 520px) {
    .type-grid { grid-template-columns: repeat(2, 1fr); }
    .preview-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
