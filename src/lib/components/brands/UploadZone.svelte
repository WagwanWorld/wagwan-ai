<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CloudArrowUp from 'phosphor-svelte/lib/CloudArrowUp';

  const dispatch = createEventDispatcher();
  let dragging = false;
  let uploading = false;
  let fileInput: HTMLInputElement;

  export let uploads: Array<{ url: string; mediaType: string; fileName: string }> = [];

  async function handleFiles(files: FileList | File[]) {
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
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  }
</script>

<div
  class="upload-zone"
  class:dragging
  class:has-files={uploads.length > 0}
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
    accept="image/jpeg,video/mp4"
    multiple
    bind:this={fileInput}
    on:change={(e) => e.currentTarget.files && handleFiles(e.currentTarget.files)}
    style="display:none"
  />

  {#if uploading}
    <p class="upload-label">Uploading...</p>
  {:else if uploads.length === 0}
    <CloudArrowUp size={32} weight="light" />
    <p class="upload-label">Drop creatives here or click to browse</p>
    <p class="upload-hint">JPEG images or MP4 videos. Max 10 files.</p>
  {:else}
    <div class="upload-thumbs">
      {#each uploads as u}
        <div class="upload-thumb">
          {#if u.mediaType === 'IMAGE'}
            <img src={u.url} alt={u.fileName} />
          {:else}
            <div class="video-thumb">MP4</div>
          {/if}
        </div>
      {/each}
      <div class="upload-add">+</div>
    </div>
  {/if}
</div>

<style>
  .upload-zone {
    border: 2px dashed var(--border-subtle);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
  }
  .upload-zone:hover, .upload-zone.dragging {
    border-color: var(--accent-primary);
    background: var(--panel-surface-soft);
  }
  .upload-zone.has-files { padding: 16px; }
  .upload-label { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin: 0; }
  .upload-hint { font-size: 12px; color: var(--text-muted); margin: 0; }
  .upload-thumbs { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
  .upload-thumb { width: 72px; height: 72px; border-radius: 10px; overflow: hidden; }
  .upload-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .video-thumb {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--glass-medium); font-size: 11px; font-weight: 700; color: var(--text-muted);
  }
  .upload-add {
    width: 72px; height: 72px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    border: 2px dashed var(--border-subtle); font-size: 24px; color: var(--text-muted);
  }
</style>
