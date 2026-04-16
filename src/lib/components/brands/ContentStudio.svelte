<script lang="ts">
  import { onMount } from 'svelte';
  import UploadZone from './UploadZone.svelte';
  import ContentPlanView from './ContentPlanView.svelte';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck';

  export let brandProfile: {
    ig_user_id: string; ig_username: string; ig_name: string;
    ig_profile_picture: string; ig_followers_count: number;
  };

  let uploads: Array<{ url: string; mediaType: string; fileName: string }> = [];
  let planPosts: Array<{
    gcsUrl: string; mediaType: string; caption: string; hashtags: string[];
    scheduledAt: string; reasoning: string; status: string;
  }> = [];
  let generating = false;
  let scheduling = false;
  let genError = '';
  let scheduleMsg = '';
  let publishedPosts: Array<Record<string, unknown>> = [];

  async function generatePlan() {
    if (!uploads.length) return;
    generating = true;
    genError = '';
    try {
      const res = await fetch('/api/brand/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatives: uploads }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        planPosts = data.plan.map((p: Record<string, unknown>) => ({ ...p, status: 'draft' }));
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
        planPosts = planPosts.map(p => ({ ...p, status: 'scheduled' }));
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

  <UploadZone bind:uploads on:error={(e) => genError = e.detail.errors.map((e: {error: string}) => e.error).join(', ')} />

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
      <button class="studio-btn studio-btn--approve" on:click={approveSchedule} disabled={scheduling}>
        <CalendarCheck size={18} weight="bold" />
        {scheduling ? 'Scheduling...' : `Approve & schedule ${planPosts.length} posts`}
      </button>
    {/if}

    {#if scheduleMsg}
      <p class="studio-success">{scheduleMsg}</p>
    {/if}
  {/if}

  {#if publishedPosts.length > 0}
    <div class="studio-section-label">Scheduled & published</div>
    <ContentPlanView posts={publishedPosts.map(p => ({
      gcsUrl: String(p.gcs_url || ''),
      mediaType: String(p.media_type || 'IMAGE'),
      caption: String(p.caption || ''),
      hashtags: (p.hashtags || []) as string[],
      scheduledAt: String(p.scheduled_at || ''),
      reasoning: String(p.ai_reasoning || ''),
      status: String(p.status || ''),
      igPermalink: String(p.ig_permalink || ''),
    }))} />
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
  .studio-error { font-size: 13px; color: var(--accent-primary); margin: 0; }
  .studio-success { font-size: 13px; color: #4ade80; margin: 0; font-weight: 600; }
</style>
