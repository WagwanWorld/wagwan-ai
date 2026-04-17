<script lang="ts">
  import { onMount } from 'svelte';
  import UploadZone from './UploadZone.svelte';
  import ContentPlanView from './ContentPlanView.svelte';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck';
  import Rocket from 'phosphor-svelte/lib/Rocket';

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
        <div class="published-card">
          <div class="published-thumb">
            {#if String(p.media_type) === 'IMAGE' || String(p.media_type) === 'CAROUSEL'}
              <img src={String(p.gcs_url)} alt="" />
            {:else}
              <div class="published-video-badge">{p.media_type}</div>
            {/if}
          </div>
          <div class="published-info">
            <p class="published-caption">{String(p.caption || '').slice(0, 80)}{String(p.caption || '').length > 80 ? '...' : ''}</p>
            <div class="published-meta">
              <span class="published-status" class:published={p.status === 'published'} class:failed={p.status === 'failed'} class:scheduled={p.status === 'scheduled'}>
                {p.status}
              </span>
              {#if p.scheduled_at}
                <span class="published-time">{new Date(String(p.scheduled_at)).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              {/if}
            </div>
          </div>
          <div class="published-actions">
            {#if p.status === 'scheduled'}
              <button class="publish-now-btn" on:click={() => publishNow(String(p.id))} disabled={publishing}>
                <Rocket size={14} weight="bold" />
                {publishing ? '...' : 'Publish now'}
              </button>
            {/if}
            {#if p.ig_permalink}
              <a href={String(p.ig_permalink)} target="_blank" rel="noopener" class="view-ig-link">View</a>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .studio { display: flex; flex-direction: column; gap: 20px; }
  .studio-account {
    display: flex; align-items: center; gap: 12px;
    padding: 16px; background: var(--panel-surface); border: 1px solid var(--panel-border);
    border-radius: 14px;
  }
  .studio-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .studio-username { font-size: 15px; font-weight: 700; color: var(--text-primary); display: block; }
  .studio-followers { font-size: 12px; color: var(--text-muted); }
  .studio-section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-top: 8px;
  }
  .studio-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 14px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
    transition: all 0.2s;
  }
  .studio-btn:disabled { opacity: 0.5; cursor: default; }
  .studio-btn--primary {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    color: white;
  }
  .studio-btn--primary:hover:not(:disabled) { box-shadow: 0 0 24px rgba(255, 77, 77, 0.2); }
  .studio-btn--approve { background: var(--accent-secondary); color: white; }
  .studio-actions { display: flex; gap: 10px; }
  .studio-error { font-size: 13px; color: var(--accent-primary); margin: 0; }
  .studio-success { font-size: 13px; color: #4ade80; margin: 0; font-weight: 600; }

  /* Published list */
  .published-list { display: flex; flex-direction: column; gap: 10px; }
  .published-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px; background: var(--panel-surface);
    border: 1px solid var(--panel-border); border-radius: 12px;
  }
  .published-thumb {
    width: 56px; height: 56px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
  }
  .published-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .published-video-badge {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--glass-medium); font-size: 10px; font-weight: 700; color: var(--text-muted);
  }
  .published-info { flex: 1; min-width: 0; }
  .published-caption {
    font-size: 13px; color: var(--text-primary); margin: 0 0 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .published-meta { display: flex; align-items: center; gap: 8px; }
  .published-status {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    padding: 2px 8px; border-radius: 6px;
    background: var(--glass-medium); color: var(--text-muted);
  }
  .published-status.published { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
  .published-status.failed { background: rgba(251, 113, 133, 0.15); color: #fb7185; }
  .published-status.scheduled { background: rgba(255, 184, 77, 0.15); color: #FFB84D; }
  .published-time { font-size: 11px; color: var(--text-muted); }
  .published-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .publish-now-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 12px; border-radius: 8px; border: none;
    background: var(--accent-primary); color: white;
    font-size: 12px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: opacity 0.15s;
  }
  .publish-now-btn:disabled { opacity: 0.5; }
  .view-ig-link {
    font-size: 11px; color: var(--accent-secondary);
    text-decoration: none; text-align: center;
  }
  .view-ig-link:hover { text-decoration: underline; }
</style>
