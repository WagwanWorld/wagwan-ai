<script lang="ts">
  import { onMount } from 'svelte';
  import UploadZone from './UploadZone.svelte';
  import ContentPlanView from './ContentPlanView.svelte';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck';
  import Rocket from 'phosphor-svelte/lib/Rocket';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';

  export let brandProfile: {
    ig_user_id: string; ig_username: string; ig_name: string;
    ig_profile_picture: string; ig_followers_count: number;
  };

  let uploads: Array<{ url: string; mediaType: string; postType: string; fileName: string }> = [];
  let planPosts: Array<{
    gcsUrl: string; mediaType: string; caption: string; hashtags: string[];
    scheduledAt: string; reasoning: string; status: string;
  }> = [];
  let generating = false;
  let scheduling = false;
  let publishing = false;
  let genError = '';
  let scheduleMsg = '';
  let publishedPosts: Array<Record<string, unknown>> = [];
  let editingPostId: string | null = null;
  let editCaption = '';
  let editTime = '';
  let saving = false;

  function startEdit(post: Record<string, unknown>) {
    editingPostId = String(post.id);
    editCaption = String(post.caption || '');
    const dt = post.scheduled_at ? new Date(String(post.scheduled_at)) : new Date();
    editTime = dt.toISOString().slice(0, 16);
  }

  function cancelEdit() {
    editingPostId = null;
    editCaption = '';
    editTime = '';
  }

  async function saveEdit() {
    if (!editingPostId) return;
    saving = true;
    try {
      const res = await fetch('/api/brand/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: editingPostId,
          caption: editCaption,
          scheduledAt: new Date(editTime).toISOString(),
        }),
      });
      if (res.ok) {
        cancelEdit();
        await loadPublished();
        scheduleMsg = 'Post updated.';
      }
    } catch {} finally {
      saving = false;
    }
  }

  async function deletePost(postId: string) {
    try {
      await fetch('/api/brand/scheduled-posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      await loadPublished();
    } catch {}
  }

  async function generatePlan() {
    if (!uploads.length) return;
    generating = true;
    genError = '';
    try {
      // Pass postType from upload so the AI knows what type each creative is
      const creatives = uploads.map(u => ({
        url: u.url,
        mediaType: u.mediaType,
        postType: u.postType,
        fileName: u.fileName,
      }));
      const res = await fetch('/api/brand/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatives }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        // Override mediaType with the user's chosen postType
        planPosts = data.plan.map((p: Record<string, unknown>, i: number) => ({
          ...p,
          mediaType: uploads[i]?.postType || p.mediaType || 'IMAGE',
          status: 'draft',
        }));
      } else {
        genError = data.error || 'Plan generation failed';
      }
    } catch {
      genError = 'Network error';
    } finally {
      generating = false;
    }
  }

  async function approveSchedule() {
    if (!planPosts.length) return;
    scheduling = true;
    scheduleMsg = '';
    try {
      const res = await fetch('/api/brand/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: planPosts }),
      });
      const data = await res.json();
      if (data.ok) {
        scheduleMsg = `${data.scheduledCount} posts scheduled!`;
        planPosts = [];
        uploads = [];
        await loadPublished();
      } else {
        scheduleMsg = data.error || 'Scheduling failed';
      }
    } catch {
      scheduleMsg = 'Network error';
    } finally {
      scheduling = false;
    }
  }

  async function publishNow(postId: string) {
    publishing = true;
    scheduleMsg = '';
    try {
      const res = await fetch('/api/brand/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (data.ok) {
        scheduleMsg = `Published! View on Instagram`;
        await loadPublished();
      } else {
        scheduleMsg = `Publish failed: ${data.error || 'Unknown error'}`;
      }
    } catch {
      scheduleMsg = 'Network error';
    } finally {
      publishing = false;
    }
  }

  async function loadPublished() {
    try {
      const res = await fetch('/api/brand/scheduled-posts');
      const data = await res.json();
      if (data.ok) publishedPosts = data.posts;
    } catch {}
  }

  onMount(loadPublished);
</script>

<div class="studio">
  <div class="studio-account">
    {#if brandProfile.ig_profile_picture}
      <img src={brandProfile.ig_profile_picture} alt="" class="studio-avatar" />
    {/if}
    <div>
      <span class="studio-username">@{brandProfile.ig_username}</span>
      <span class="studio-followers">{brandProfile.ig_followers_count.toLocaleString()} followers</span>
    </div>
  </div>

  <UploadZone bind:uploads on:error={(e) => genError = e.detail.errors.map((err: {error: string}) => err.error).join(', ')} />

  {#if uploads.length > 0 && planPosts.length === 0}
    <button class="studio-btn studio-btn--primary" on:click={generatePlan} disabled={generating}>
      <Sparkle size={18} weight="bold" />
      {generating ? 'Generating plan...' : `Generate plan for ${uploads.length} creative${uploads.length > 1 ? 's' : ''}`}
    </button>
  {/if}

  {#if genError}
    <p class="studio-error">{genError}</p>
  {/if}

  {#if planPosts.length > 0}
    <div class="studio-section-label">Content plan</div>
    <ContentPlanView bind:posts={planPosts} />

    {#if planPosts.some(p => p.status === 'draft')}
      <div class="studio-actions">
        <button class="studio-btn studio-btn--approve" on:click={approveSchedule} disabled={scheduling}>
          <CalendarCheck size={18} weight="bold" />
          {scheduling ? 'Scheduling...' : 'Schedule for later'}
        </button>
      </div>
    {/if}

    {#if scheduleMsg}
      <p class="studio-success">{scheduleMsg}</p>
    {/if}
  {/if}

  {#if publishedPosts.length > 0}
    <div class="studio-section-label">Scheduled & published</div>
    <div class="published-list">
      {#each publishedPosts as p}
        <div class="published-card" class:editing={editingPostId === String(p.id)}>
          <div class="published-thumb">
            {#if String(p.media_type) === 'IMAGE' || String(p.media_type) === 'CAROUSEL'}
              <img src={String(p.gcs_url)} alt="" />
            {:else}
              <div class="published-video-badge">{p.media_type}</div>
            {/if}
            <span class="pub-type-badge">{p.media_type}</span>
          </div>

          {#if editingPostId === String(p.id)}
            <!-- Edit mode -->
            <div class="published-info edit-mode">
              <label class="edit-label">
                <span class="edit-label-text">Caption</span>
                <textarea class="edit-textarea" bind:value={editCaption} rows="4"></textarea>
              </label>
              <label class="edit-label">
                <span class="edit-label-text">Scheduled time</span>
                <input class="edit-input" type="datetime-local" bind:value={editTime} />
              </label>
              <div class="edit-actions">
                <button class="edit-save" on:click={saveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button class="edit-cancel" on:click={cancelEdit}>Cancel</button>
              </div>
            </div>
          {:else}
            <!-- View mode -->
            <div class="published-info">
              <p class="published-caption">{String(p.caption || 'No caption')}</p>
              {#if p.hashtags && Array.isArray(p.hashtags) && p.hashtags.length}
                <div class="pub-hashtags">
                  {#each p.hashtags as tag}
                    <span class="pub-tag">#{tag}</span>
                  {/each}
                </div>
              {/if}
              <div class="published-meta">
                <span class="published-status" class:published={p.status === 'published'} class:failed={p.status === 'failed'} class:scheduled={p.status === 'scheduled'}>
                  {p.status}
                </span>
                {#if p.scheduled_at}
                  <span class="published-time">{new Date(String(p.scheduled_at)).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                {/if}
              </div>
              {#if p.ai_reasoning}
                <p class="pub-reasoning">{p.ai_reasoning}</p>
              {/if}
            </div>
            <div class="published-actions">
              {#if p.status === 'scheduled' || p.status === 'draft'}
                <button class="pub-edit-btn" on:click={() => startEdit(p)} title="Edit">
                  <PencilSimple size={14} />
                  Edit
                </button>
                <button class="publish-now-btn" on:click={() => publishNow(String(p.id))} disabled={publishing}>
                  <Rocket size={14} weight="bold" />
                  {publishing ? '...' : 'Publish'}
                </button>
                <button class="pub-delete-btn" on:click={() => deletePost(String(p.id))} title="Delete">
                  <Trash size={14} />
                </button>
              {/if}
              {#if p.ig_permalink}
                <a href={String(p.ig_permalink)} target="_blank" rel="noopener" class="view-ig-link">View on IG</a>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .studio { display: flex; flex-direction: column; gap: 20px; }
  .studio-account {
    display: flex; align-items: center; gap: 12px;
    padding: 16px;
    background: var(--g-flat-bg, linear-gradient(175deg, rgba(255,255,255,0.025), rgba(255,255,255,0.006)));
    border: 1px solid var(--g-border, rgba(255,255,255,0.06));
    border-radius: 16px;
    box-shadow: var(--g-flat-shadow, 0 2px 8px rgba(0,0,0,0.08));
  }
  .studio-avatar { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; }
  .studio-username { font-size: 14px; font-weight: 600; color: var(--g-text, #EDEDEF); display: block; }
  .studio-followers { font-size: 12px; color: var(--g-text-3, #4A4A50); }
  .studio-section-label {
    font-size: var(--g-label-size, 11px); font-weight: var(--g-label-weight, 500);
    text-transform: uppercase; letter-spacing: var(--g-label-spacing, 0.08em);
    color: var(--g-text-3, #4A4A50); margin-top: 8px;
  }
  .studio-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 14px; border: 1px solid var(--g-border, rgba(255,255,255,0.06));
    border-radius: 14px;
    font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
    transition: all var(--g-dur-fast, 0.4s) var(--g-ease);
    background: var(--g-flat-bg);
    color: var(--g-text-2, #8A8A90);
  }
  .studio-btn:disabled { opacity: 0.5; cursor: default; }
  .studio-btn--primary {
    background: var(--g-accent-soft, rgba(232,70,74,0.08));
    border-color: var(--g-accent, #E8464A);
    color: var(--g-accent, #E8464A);
  }
  .studio-btn--primary:hover:not(:disabled) { background: rgba(232,70,74,0.14); box-shadow: 0 0 24px var(--g-accent-glow, rgba(232,70,74,0.12)); }
  .studio-btn--approve {
    background: rgba(127,200,169,0.08);
    border-color: var(--g-metric-engagement, #7FC8A9);
    color: var(--g-metric-engagement, #7FC8A9);
  }
  .studio-btn--approve:hover:not(:disabled) { background: rgba(127,200,169,0.14); }
  .studio-actions { display: flex; gap: 10px; }
  .studio-error { font-size: 13px; color: var(--g-accent, #E8464A); margin: 0; }
  .studio-success { font-size: 13px; color: var(--g-metric-engagement, #7FC8A9); margin: 0; font-weight: 600; }

  /* Published list */
  .published-list { display: flex; flex-direction: column; gap: 10px; }
  .published-card {
    display: flex; align-items: center; gap: 12px;
    padding: 14px;
    background: var(--g-flat-bg, linear-gradient(175deg, rgba(255,255,255,0.025), rgba(255,255,255,0.006)));
    border: 1px solid var(--g-border, rgba(255,255,255,0.06));
    border-radius: 16px;
    box-shadow: var(--g-flat-shadow, 0 2px 8px rgba(0,0,0,0.08));
    transition: border-color var(--g-dur, 0.7s) var(--g-ease);
  }
  .published-card:hover { border-color: var(--g-border-strong, rgba(255,255,255,0.12)); }
  .published-thumb {
    width: 56px; height: 56px; border-radius: 10px; overflow: hidden; flex-shrink: 0;
    position: relative;
  }
  .published-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .published-video-badge {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--g-surface, #17171A); font-size: 10px; font-weight: 700; color: var(--g-text-3, #4A4A50);
  }
  .published-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .published-caption {
    font-size: 13px; color: var(--g-text, #EDEDEF); margin: 0;
    line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  }
  .pub-hashtags { display: flex; flex-wrap: wrap; gap: 4px; }
  .pub-tag { font-size: 11px; color: var(--g-metric-shares, #7BA7D9); font-weight: 600; }
  .pub-reasoning { font-size: 11px; color: var(--g-text-3, #4A4A50); margin: 0; font-style: italic; line-height: 1.4; }
  .pub-type-badge {
    position: absolute; bottom: 4px; left: 4px;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px;
  }
  .published-meta { display: flex; align-items: center; gap: 8px; }
  .published-status {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    padding: 2px 8px; border-radius: 6px;
    background: var(--g-surface, #17171A); color: var(--g-text-3, #4A4A50);
  }
  .published-status.published { background: rgba(127,200,169,0.12); color: var(--g-metric-engagement, #7FC8A9); }
  .published-status.failed { background: rgba(232,70,74,0.12); color: var(--g-accent, #E8464A); }
  .published-status.scheduled { background: rgba(232,131,58,0.12); color: var(--g-metric-reach, #E8833A); }
  .published-time { font-size: 11px; color: var(--g-text-3, #4A4A50); font-family: var(--g-font-mono); }
  .published-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
  .pub-edit-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 12px; border: 1px solid var(--g-border, rgba(255,255,255,0.06)); border-radius: 10px;
    background: transparent; color: var(--g-text-2, #8A8A90);
    font-size: 12px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: all var(--g-dur-fast, 0.4s) var(--g-ease);
  }
  .pub-edit-btn:hover { border-color: var(--g-border-strong); color: var(--g-text); }
  .pub-delete-btn {
    display: flex; align-items: center; justify-content: center;
    padding: 6px; border: 1px solid var(--g-border, rgba(255,255,255,0.06)); border-radius: 10px;
    background: transparent; color: var(--g-text-3, #4A4A50);
    cursor: pointer; transition: all var(--g-dur-fast, 0.4s) var(--g-ease);
  }
  .pub-delete-btn:hover { border-color: var(--g-accent); color: var(--g-accent); }
  .publish-now-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 14px; border-radius: 10px;
    border: 1px solid var(--g-accent, #E8464A);
    background: var(--g-accent-soft, rgba(232,70,74,0.08));
    color: var(--g-accent, #E8464A);
    font-size: 12px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: all var(--g-dur-fast, 0.4s) var(--g-ease);
  }
  .publish-now-btn:hover { background: rgba(232,70,74,0.14); }
  .publish-now-btn:disabled { opacity: 0.5; }
  .view-ig-link {
    font-size: 11px; color: var(--g-metric-shares, #7BA7D9);
    text-decoration: none; text-align: center;
  }
  .view-ig-link:hover { text-decoration: underline; }

  /* Edit mode */
  .published-card.editing { border-color: var(--g-metric-shares, #7BA7D9); }
  .edit-mode { gap: 12px; }
  .edit-label { display: flex; flex-direction: column; gap: 4px; }
  .edit-label-text {
    font-size: var(--g-label-size, 11px); font-weight: var(--g-label-weight, 500);
    text-transform: uppercase; letter-spacing: var(--g-label-spacing, 0.08em);
    color: var(--g-text-3, #4A4A50);
  }
  .edit-textarea {
    width: 100%; box-sizing: border-box; font-size: 13px; font-family: inherit;
    background: var(--g-surface, #17171A); border: 1px solid var(--g-border, rgba(255,255,255,0.06));
    border-radius: 10px; padding: 10px; color: var(--g-text, #EDEDEF); resize: vertical;
    line-height: 1.5;
  }
  .edit-textarea:focus { border-color: var(--g-metric-shares, #7BA7D9); outline: none; }
  .edit-input {
    font-size: 13px; font-family: inherit;
    background: var(--g-surface, #17171A); border: 1px solid var(--g-border, rgba(255,255,255,0.06));
    border-radius: 10px; padding: 8px 10px; color: var(--g-text, #EDEDEF);
  }
  .edit-input:focus { border-color: var(--g-metric-shares, #7BA7D9); outline: none; }
  .edit-actions { display: flex; gap: 8px; }
  .edit-save {
    padding: 8px 16px; border-radius: 10px;
    border: 1px solid var(--g-accent, #E8464A);
    background: var(--g-accent-soft, rgba(232,70,74,0.08));
    color: var(--g-accent, #E8464A);
    font-size: 12px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: all var(--g-dur-fast) var(--g-ease);
  }
  .edit-save:hover { background: rgba(232,70,74,0.14); }
  .edit-save:disabled { opacity: 0.5; }
  .edit-cancel {
    padding: 8px 16px; border: 1px solid var(--g-border, rgba(255,255,255,0.06)); border-radius: 10px;
    background: transparent; color: var(--g-text-2, #8A8A90);
    font-size: 12px; font-weight: 500; font-family: inherit;
    cursor: pointer; transition: all var(--g-dur-fast) var(--g-ease);
  }
  .edit-cancel:hover { border-color: var(--g-border-strong); color: var(--g-text); }
</style>
