<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let ideas: Array<{
    id: string;
    copy: string;
    caption: string;
    format: string;
    rationale: string;
  }> = [];

  const dispatch = createEventDispatcher<{
    pick: { id: string; copy: string; caption: string; format: string; rationale: string };
    generateMore: void;
    back: void;
  }>();

  // Track which card is being edited
  let editingId: string | null = null;
  // Per-card copy edits (keyed by idea id)
  let editedCopy: Record<string, string> = {};

  function getCopy(idea: typeof ideas[0]): string {
    return editedCopy[idea.id] ?? idea.copy;
  }

  function startEdit(id: string, current: string) {
    editingId = id;
    if (!(id in editedCopy)) editedCopy[id] = current;
  }

  function formatBadge(format: string): string {
    if (format === 'story_9x16') return '9:16 STORY';
    if (format === 'carousel') return 'CAROUSEL';
    return '4:5 STATIC';
  }

  function handlePick(idea: typeof ideas[0]) {
    dispatch('pick', { ...idea, copy: getCopy(idea) });
  }
</script>

<div class="cip">
  <div class="cip-header">
    <button class="cip-back" on:click={() => dispatch('back')}>← Back</button>
    <div>
      <h2 class="cip-title">Pick a Copy Direction</h2>
      <p class="cip-subtitle">Click any copy text to edit it inline — then hit "Use This" to proceed</p>
    </div>
  </div>

  <div class="cip-list">
    {#each ideas as idea (idea.id)}
      {@const currentCopy = getCopy(idea)}
      <div class="cip-card">
        <!-- Format badge -->
        <div class="cip-top-row">
          <span class="cip-badge">{formatBadge(idea.format)}</span>
          <span class="cip-idea-num">{idea.id.replace('idea_', '#')}</span>
        </div>

        <!-- Copy text — click to edit -->
        {#if editingId === idea.id}
          <textarea
            class="cip-copy-edit"
            bind:value={editedCopy[idea.id]}
            rows="3"
            on:blur={() => { editingId = null; }}
            autofocus
          ></textarea>
        {:else}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="cip-copy"
            on:click={() => startEdit(idea.id, currentCopy)}
            title="Click to edit"
          >
            {currentCopy}
            <span class="cip-edit-hint">✎</span>
          </div>
        {/if}

        <!-- Caption preview -->
        <p class="cip-caption">{idea.caption}</p>

        <!-- Rationale -->
        <p class="cip-rationale">{idea.rationale}</p>

        <!-- Use This -->
        <button class="cip-use-btn" on:click={() => handlePick(idea)}>
          Use This →
        </button>
      </div>
    {/each}
  </div>

  <div class="cip-footer">
    <button class="cip-more-btn" on:click={() => dispatch('generateMore')}>
      ✦ Generate More Ideas
    </button>
  </div>
</div>

<style>
  .cip {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  /* Header */
  .cip-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .cip-back {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a4a50;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 3px;
  }
  .cip-back:hover { color: #ededef; border-color: rgba(255, 255, 255, 0.15); }

  .cip-title {
    font-size: 18px;
    font-weight: 700;
    color: #ededef;
    margin: 0 0 2px;
  }
  .cip-subtitle { font-size: 12px; color: #4a4a50; margin: 0; }

  /* Card list */
  .cip-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Individual idea card */
  .cip-card {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: background 0.15s, border-color 0.15s;
    cursor: default;
  }
  .cip-card:hover {
    background: rgba(232, 70, 74, 0.03);
    border-color: rgba(232, 70, 74, 0.12);
  }

  /* Top row: badge + idea number */
  .cip-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .cip-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #e8464a;
    background: rgba(232, 70, 74, 0.08);
    border: 1px solid rgba(232, 70, 74, 0.2);
    border-radius: 5px;
    padding: 3px 8px;
  }
  .cip-idea-num {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    color: #4a4a50;
    letter-spacing: 0.06em;
  }

  /* Copy text (large, prominent, clickable) */
  .cip-copy {
    font-size: 17px;
    font-weight: 700;
    color: #ededef;
    line-height: 1.35;
    cursor: text;
    position: relative;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px dashed rgba(255, 255, 255, 0.06);
    transition: border-color 0.15s, background 0.15s;
  }
  .cip-copy:hover {
    border-color: rgba(232, 70, 74, 0.25);
    background: rgba(232, 70, 74, 0.03);
  }
  .cip-edit-hint {
    font-size: 11px;
    color: #4a4a50;
    margin-left: 6px;
    opacity: 0;
    transition: opacity 0.15s;
    vertical-align: middle;
  }
  .cip-copy:hover .cip-edit-hint { opacity: 1; }

  /* Inline edit textarea */
  .cip-copy-edit {
    width: 100%;
    font-size: 17px;
    font-weight: 700;
    color: #ededef;
    line-height: 1.35;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(232, 70, 74, 0.3);
    border-radius: 8px;
    padding: 8px 10px;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .cip-copy-edit:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.5);
  }

  /* Caption preview */
  .cip-caption {
    font-size: 12px;
    color: #6a6a72;
    line-height: 1.55;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Rationale */
  .cip-rationale {
    font-size: 11px;
    color: #5a5a62;
    font-style: italic;
    margin: 0;
    line-height: 1.5;
  }

  /* Use This button */
  .cip-use-btn {
    align-self: flex-end;
    padding: 9px 20px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(232, 70, 74, 0.12);
    border: 1px solid rgba(232, 70, 74, 0.28);
    color: #e8464a;
    font-family: inherit;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .cip-use-btn:hover {
    background: rgba(232, 70, 74, 0.2);
    border-color: rgba(232, 70, 74, 0.45);
  }

  /* Footer — generate more */
  .cip-footer {
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }
  .cip-more-btn {
    padding: 9px 22px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8a8a90;
    font-family: inherit;
    transition: all 0.15s;
  }
  .cip-more-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.14);
  }
</style>
