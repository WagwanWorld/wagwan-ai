<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import XCircle from 'phosphor-svelte/lib/XCircle';
  import MinusCircle from 'phosphor-svelte/lib/MinusCircle';

  export let brandAuthenticated = false;

  const dispatch = createEventDispatcher();

  type ProgressEntry = {
    handle: string;
    status: 'success' | 'failed' | 'skipped';
    fit_label?: string;
    fit_score?: number;
    error?: string;
  };

  let dragOver = false;
  let file: File | null = null;
  let phase: 'idle' | 'uploading' | 'processing' | 'done' | 'error' = 'idle';
  let errorMsg = '';
  let progress: ProgressEntry[] = [];
  let completed = 0;
  let total = 0;
  let summary: { succeeded: number; failed: number; skipped: number } | null = null;
  let validationInfo: {
    valid_count: number;
    skipped_no_handle: number;
    duplicates_in_file: number;
    already_in_roster: number;
  } | null = null;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) selectFile(dropped);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (selected) selectFile(selected);
  }

  function selectFile(f: File) {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      errorMsg = 'Upload a .csv or .xlsx file.';
      phase = 'error';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      errorMsg = 'File too large (max 5 MB).';
      phase = 'error';
      return;
    }
    file = f;
    errorMsg = '';
    startUpload();
  }

  async function startUpload() {
    if (!file) return;
    phase = 'uploading';
    progress = [];
    completed = 0;
    total = 0;
    summary = null;
    validationInfo = null;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/brand/creator-roster/bulk', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = 'Upload failed';
        try {
          const j = JSON.parse(text);
          msg = j.message || j.error || msg;
        } catch {
          if (text) msg = text;
        }
        errorMsg = msg;
        phase = 'error';
        return;
      }

      phase = 'processing';
      const reader = res.body?.getReader();
      if (!reader) {
        errorMsg = 'No response stream';
        phase = 'error';
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            handleSSE(eventType, data);
          }
        }
      }
    } catch {
      errorMsg = 'Connection lost. Some creators may have been added.';
      phase = 'error';
    }
  }

  function handleSSE(event: string, data: Record<string, unknown>) {
    if (event === 'validated') {
      validationInfo = {
        valid_count: data.valid_count as number,
        skipped_no_handle: data.skipped_no_handle as number,
        duplicates_in_file: data.duplicates_in_file as number,
        already_in_roster: data.already_in_roster as number,
      };
      total = data.valid_count as number;
    } else if (event === 'progress') {
      completed = data.completed as number;
      progress = [
        ...progress,
        {
          handle: data.handle as string,
          status: data.status as 'success' | 'failed' | 'skipped',
          fit_label: data.fit_label as string | undefined,
          fit_score: data.fit_score as number | undefined,
          error: data.error as string | undefined,
        },
      ];
    } else if (event === 'done') {
      summary = {
        succeeded: data.succeeded as number,
        failed: data.failed as number,
        skipped: data.skipped as number,
      };
      phase = 'done';
      dispatch('rosterUpdated');
    } else if (event === 'error') {
      errorMsg = (data.message as string) || 'Processing error';
      phase = 'error';
    }
  }

  function reset() {
    file = null;
    phase = 'idle';
    errorMsg = '';
    progress = [];
    completed = 0;
    total = 0;
    summary = null;
    validationInfo = null;
  }

  let fileInput: HTMLInputElement;
</script>

<div class="bulk-upload">
  {#if phase === 'idle'}
    <div
      class="drop-zone"
      class:drag-over={dragOver}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
      on:click={() => fileInput.click()}
      on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
      role="button"
      tabindex="0"
    >
      <UploadSimple size={24} weight="light" />
      <span class="drop-label">Drop CSV or Excel file here</span>
      <span class="drop-hint">or click to browse</span>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept=".csv,.xlsx,.xls"
      on:change={handleFileInput}
      hidden
    />
  {:else if phase === 'uploading'}
    <div class="status-card">
      <span class="status-text">Parsing file…</span>
    </div>
  {:else if phase === 'processing'}
    <div class="progress-section">
      <div class="progress-header">
        <span>Processing creators…</span>
        <span class="progress-count">{completed} / {total}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {total ? (completed / total) * 100 : 0}%"></div>
      </div>

      {#if validationInfo && (validationInfo.skipped_no_handle || validationInfo.duplicates_in_file || validationInfo.already_in_roster)}
        <div class="validation-note">
          {#if validationInfo.skipped_no_handle}
            <span>{validationInfo.skipped_no_handle} rows skipped (no handle)</span>
          {/if}
          {#if validationInfo.duplicates_in_file}
            <span>{validationInfo.duplicates_in_file} duplicates in file</span>
          {/if}
          {#if validationInfo.already_in_roster}
            <span>{validationInfo.already_in_roster} already in roster</span>
          {/if}
        </div>
      {/if}

      <div class="feed">
        {#each progress as entry (entry.handle)}
          <div
            class="feed-row"
            class:success={entry.status === 'success'}
            class:fail={entry.status === 'failed'}
          >
            {#if entry.status === 'success'}
              <CheckCircle size={14} weight="fill" color="#4ade80" />
            {:else if entry.status === 'failed'}
              <XCircle size={14} weight="fill" color="#f87171" />
            {:else}
              <MinusCircle size={14} weight="fill" color="rgba(255,255,255,0.3)" />
            {/if}
            <span class="feed-handle">@{entry.handle}</span>
            <span class="feed-meta">
              {#if entry.status === 'success' && entry.fit_label}
                {entry.fit_label}{entry.fit_score != null ? ` · ${entry.fit_score}` : ''}
              {:else if entry.error}
                {entry.error}
              {/if}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {:else if phase === 'done' && summary}
    <div class="summary-card">
      <div class="summary-title">Upload complete</div>
      <div class="summary-stats">
        <span class="stat stat-green"
          ><CheckCircle size={14} weight="fill" /> {summary.succeeded} added</span
        >
        {#if summary.failed}
          <span class="stat stat-red"
            ><XCircle size={14} weight="fill" /> {summary.failed} failed</span
          >
        {/if}
        {#if summary.skipped}
          <span class="stat stat-gray"
            ><MinusCircle size={14} weight="fill" /> {summary.skipped} skipped</span
          >
        {/if}
      </div>
      <div class="summary-actions">
        <button class="btn-secondary" on:click={reset}>Upload another</button>
        <button class="btn-primary" on:click={() => dispatch('goRoster')}>View roster</button>
      </div>
    </div>
  {:else if phase === 'error'}
    <div class="error-card">
      <p class="error-text">{errorMsg}</p>
      <button class="btn-secondary" on:click={reset}>Try again</button>
    </div>
  {/if}
</div>

<style>
  .bulk-upload {
    margin-top: 12px;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 32px 16px;
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease;
    color: rgba(255, 248, 232, 0.5);
  }
  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: #c4f24a;
    background: rgba(196, 242, 74, 0.04);
  }
  .drop-label {
    font-size: 13px;
    font-weight: 500;
  }
  .drop-hint {
    font-size: 11px;
    color: rgba(255, 248, 232, 0.3);
  }

  .status-card {
    padding: 24px;
    text-align: center;
    color: rgba(255, 248, 232, 0.5);
    font-size: 13px;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: rgba(255, 248, 232, 0.6);
  }
  .progress-count {
    color: #c4f24a;
    font-weight: 600;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  }
  .progress-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #c4f24a;
    border-radius: 2px;
    transition: width 300ms ease;
  }

  .validation-note {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 11px;
    color: rgba(255, 248, 232, 0.35);
  }

  .feed {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 240px;
    overflow-y: auto;
  }
  .feed-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
  }
  .feed-row.success {
    background: rgba(196, 242, 74, 0.04);
  }
  .feed-row.fail {
    background: rgba(248, 113, 113, 0.04);
  }
  .feed-handle {
    color: rgba(255, 248, 232, 0.7);
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
  }
  .feed-meta {
    margin-left: auto;
    font-size: 10px;
    color: rgba(255, 248, 232, 0.3);
    white-space: nowrap;
  }

  .summary-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px;
  }
  .summary-title {
    font-size: 15px;
    font-weight: 600;
    color: #c4f24a;
  }
  .summary-stats {
    display: flex;
    gap: 16px;
    font-size: 13px;
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .stat-green {
    color: #4ade80;
  }
  .stat-red {
    color: #f87171;
  }
  .stat-gray {
    color: rgba(255, 248, 232, 0.4);
  }

  .summary-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .btn-primary {
    padding: 8px 18px;
    background: #c4f24a;
    color: #000;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-secondary {
    padding: 8px 18px;
    background: transparent;
    color: rgba(255, 248, 232, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }

  .error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px;
  }
  .error-text {
    font-size: 13px;
    color: #f87171;
    margin: 0;
  }
</style>
