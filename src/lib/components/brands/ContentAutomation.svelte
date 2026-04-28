<script lang="ts">
  import ContentPipelineStepper from './ContentPipelineStepper.svelte';
  import PostReviewCard from './PostReviewCard.svelte';
  import ScheduleCalendar from './ScheduleCalendar.svelte';
  import BulkCadenceWizard from './BulkCadenceWizard.svelte';
  import ActivityFeed from './ActivityFeed.svelte';

  type PipelineStep = 'upload' | 'generate' | 'review' | 'schedule' | 'post';
  let currentStep: PipelineStep = 'schedule'; // Default to calendar view

  interface UploadedAsset {
    gcsUrl: string;
    mediaType: string;
    fileName: string;
  }

  interface GeneratedPost {
    gcsUrl: string;
    mediaType: string;
    fileName?: string;
    caption: string;
    hashtags: string[];
    mentions: string[];
    location: string;
    altText: string;
    postType: string;
  }

  interface ScheduledPost {
    id: string;
    gcs_url: string;
    media_type: string;
    caption: string;
    scheduled_at: string;
    status: string;
    error_message?: string;
  }

  let uploadedAssets: UploadedAsset[] = [];
  let generatedPosts: GeneratedPost[] = [];
  let scheduledPosts: ScheduledPost[] = [];
  let reviewIndex = 0;
  let generating = false;
  let uploading = false;
  let calendarLoading = false;
  let contextHint = '';
  let uploadError = '';

  // Load scheduled posts for calendar
  async function loadScheduledPosts() {
    calendarLoading = true;
    try {
      const res = await fetch('/api/brand/scheduled-posts', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        scheduledPosts = data.posts || [];
      }
    } catch { /* silent */ }
    finally { calendarLoading = false; }
  }

  // Upload files
  async function handleFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    await uploadFiles(Array.from(input.files));
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer?.files.length) return;
    await uploadFiles(Array.from(e.dataTransfer.files));
  }

  async function uploadFiles(files: File[]) {
    uploading = true;
    uploadError = '';
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/brand/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const newAssets: UploadedAsset[] = (data.uploads || []).map((u: { url: string; mediaType: string; fileName: string }) => ({
        gcsUrl: u.url,
        mediaType: u.mediaType,
        fileName: u.fileName,
      }));
      uploadedAssets = [...uploadedAssets, ...newAssets];
      currentStep = uploadedAssets.length > 1 ? 'generate' : 'generate';
    } catch (e) {
      uploadError = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }

  // Generate AI content
  async function generateContent(assets: UploadedAsset[]) {
    generating = true;
    currentStep = 'generate';
    try {
      const res = await fetch('/api/brand/generate-post-content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets, context: contextHint || undefined }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      generatedPosts = data.results || [];
      reviewIndex = 0;
      currentStep = 'review';
    } catch {
      uploadError = 'AI generation failed — try again';
      currentStep = 'upload';
    } finally {
      generating = false;
    }
  }

  // Schedule single post
  async function schedulePost(e: CustomEvent<{ asset: GeneratedPost; scheduledAt: string }>) {
    const { asset, scheduledAt } = e.detail;
    try {
      await fetch('/api/brand/schedule', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: [{
            gcsUrl: asset.gcsUrl,
            mediaType: asset.postType || asset.mediaType,
            caption: asset.caption,
            hashtags: asset.hashtags,
            altText: asset.altText,
            scheduledAt,
          }],
        }),
      });
      // Move to next post or calendar
      if (reviewIndex < generatedPosts.length - 1) {
        reviewIndex++;
      } else {
        currentStep = 'schedule';
        loadScheduledPosts();
      }
    } catch { uploadError = 'Scheduling failed'; }
  }

  // Bulk schedule
  async function bulkSchedule(e: CustomEvent<{
    assets: UploadedAsset[];
    cadence: { frequency: string; startDate: string; time: string; timezone: string };
  }>) {
    const { cadence } = e.detail;
    generating = true;
    currentStep = 'generate';
    try {
      // First generate content for all assets
      const genRes = await fetch('/api/brand/generate-post-content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: uploadedAssets, context: contextHint || undefined }),
      });
      if (!genRes.ok) throw new Error('Generation failed');
      const genData = await genRes.json();
      const posts = (genData.results || []).map((r: GeneratedPost) => ({
        gcsUrl: r.gcsUrl,
        mediaType: r.postType || r.mediaType,
        caption: r.caption,
        hashtags: r.hashtags,
        altText: r.altText,
      }));

      // Then bulk schedule
      const schedRes = await fetch('/api/brand/schedule-bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts, cadence }),
      });
      if (!schedRes.ok) throw new Error('Scheduling failed');

      currentStep = 'schedule';
      loadScheduledPosts();
    } catch {
      uploadError = 'Bulk scheduling failed';
      currentStep = 'upload';
    } finally {
      generating = false;
    }
  }

  // Retry failed post
  async function retryPost(e: CustomEvent<{ postId: string }>) {
    try {
      await fetch('/api/brand/publish-now', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: e.detail.postId }),
      });
      loadScheduledPosts();
    } catch { /* silent */ }
  }

  // Regenerate single post content
  async function regeneratePost(e: CustomEvent<{ index: number }>) {
    const idx = e.detail.index;
    const asset = uploadedAssets[idx];
    if (!asset) return;
    generating = true;
    try {
      const res = await fetch('/api/brand/generate-post-content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: [asset], context: contextHint || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]) {
          generatedPosts = generatedPosts.map((p, i) => (i === idx ? data.results[0] : p));
        }
      }
    } catch { /* silent */ }
    finally { generating = false; }
  }

  // Navigate to upload from calendar
  function handleNewPost(e: CustomEvent<{ date: string }>) {
    currentStep = 'upload';
  }

  // Init: load calendar
  import { onMount } from 'svelte';
  onMount(loadScheduledPosts);
</script>

<div class="ca-container">
  <div class="ca-main">
    <ContentPipelineStepper {currentStep} />

    {#if currentStep === 'upload'}
      <div class="ca-card">
        <span class="ca-label">DROP ASSETS</span>
        <div
          class="ca-upload-zone"
          on:drop={handleDrop}
          on:dragover|preventDefault
          role="button"
          tabindex="0"
        >
          <div class="ca-upload-icon">⇪</div>
          <div class="ca-upload-title">Drop images, videos, or carousels</div>
          <div class="ca-upload-hint">.jpg .png .webp .mp4 .mov — or multiple for carousels</div>
          <label class="ca-upload-browse">
            or browse files
            <input type="file" multiple accept="image/*,video/*" on:change={handleFiles} style="display:none" />
          </label>
        </div>
        <div class="ca-context">
          <span class="ca-label" style="margin-bottom:4px">CONTEXT FOR AI (OPTIONAL)</span>
          <input
            class="ca-context-input"
            bind:value={contextHint}
            placeholder='"summer campaign", "behind the scenes", "product launch"...'
          />
        </div>
        {#if uploading}
          <div class="ca-status">Uploading...</div>
        {/if}
        {#if uploadError}
          <div class="ca-error">{uploadError}</div>
        {/if}
        {#if uploadedAssets.length > 0}
          <div class="ca-uploaded-bar">
            <span class="ca-label">{uploadedAssets.length} ASSET{uploadedAssets.length > 1 ? 'S' : ''} READY</span>
            {#if uploadedAssets.length > 1}
              <button class="ca-btn-primary" on:click={() => (currentStep = 'generate')}>Set Cadence & Generate</button>
            {:else}
              <button class="ca-btn-primary" on:click={() => generateContent(uploadedAssets)}>Generate Content</button>
            {/if}
          </div>
        {/if}
      </div>

    {:else if currentStep === 'generate'}
      {#if uploadedAssets.length > 1}
        <BulkCadenceWizard
          assets={uploadedAssets}
          on:scheduleAll={bulkSchedule}
          on:editIndividual={() => generateContent(uploadedAssets)}
        />
      {:else}
        <div class="ca-card">
          <span class="ca-label" style="color:#e8464a">AI GENERATING</span>
          <div class="ca-processing">
            <div class="ca-proc-title">Generating content...</div>
            <div class="ca-proc-sub">Analysing visuals · Reading brand kit · Writing captions</div>
          </div>
        </div>
      {/if}

    {:else if currentStep === 'review' && generatedPosts.length > 0}
      <PostReviewCard
        asset={generatedPosts[reviewIndex]}
        index={reviewIndex}
        total={generatedPosts.length}
        on:schedule={schedulePost}
        on:regenerate={regeneratePost}
        on:publishNow={(e) => {
          // Publish now flow — same as schedule but immediate
          const { asset } = e.detail;
          fetch('/api/brand/publish-now', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Need to schedule first then publish
              postId: 'temp',
            }),
          });
        }}
      />

    {:else if currentStep === 'schedule'}
      <ScheduleCalendar
        posts={scheduledPosts}
        loading={calendarLoading}
        on:newPost={handleNewPost}
        on:retry={retryPost}
        on:refresh={loadScheduledPosts}
      />
    {/if}
  </div>

  <ActivityFeed />
</div>

<style>
  .ca-container { display: flex; gap: 0; min-height: 500px; }
  .ca-main { flex: 1; padding: 0 16px 16px; min-width: 0; }

  .ca-card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px 16px; }
  .ca-label { font-family: 'Geist Mono Variable','SF Mono','Courier New',monospace; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #4a4a50; display: block; margin-bottom: 8px; }

  .ca-upload-zone { border: 1.5px dashed rgba(255,255,255,0.1); border-radius: 14px; padding: 40px 24px; text-align: center; background: rgba(255,255,255,0.015); cursor: pointer; transition: all 0.2s; }
  .ca-upload-zone:hover { border-color: rgba(232,70,74,0.3); background: rgba(232,70,74,0.02); }
  .ca-upload-icon { font-size: 28px; margin-bottom: 10px; opacity: 0.5; }
  .ca-upload-title { font-size: 14px; font-weight: 600; color: #ededef; }
  .ca-upload-hint { font-size: 11px; color: #4a4a50; margin-top: 4px; }
  .ca-upload-browse { display: inline-block; margin-top: 14px; padding: 6px 16px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: #8a8a90; font-size: 11px; cursor: pointer; }

  .ca-context { margin-top: 10px; padding: 10px 14px; border-radius: 10px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); }
  .ca-context-input { width: 100%; background: transparent; border: none; color: #8a8a90; font-size: 12px; font-family: 'Inter',sans-serif; }
  .ca-context-input:focus { outline: none; }
  .ca-context-input::placeholder { color: #4a4a50; font-style: italic; }

  .ca-status { margin-top: 10px; font-size: 12px; color: #e8464a; }
  .ca-error { margin-top: 10px; font-size: 12px; color: #f87171; }

  .ca-uploaded-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 12px 14px; border-radius: 10px; background: rgba(232,70,74,0.03); border: 1px solid rgba(232,70,74,0.08); }
  .ca-uploaded-bar .ca-label { margin-bottom: 0; color: #e8464a; }

  .ca-btn-primary { padding: 8px 18px; border-radius: 8px; background: rgba(232,70,74,0.15); border: 1px solid rgba(232,70,74,0.25); color: #e8464a; font-size: 12px; font-weight: 600; cursor: pointer; }
  .ca-btn-primary:hover { background: rgba(232,70,74,0.2); }

  .ca-processing { padding: 14px 16px; border-radius: 12px; background: rgba(232,70,74,0.03); border: 1px solid rgba(232,70,74,0.1); }
  .ca-proc-title { font-size: 13px; font-weight: 600; color: #ededef; }
  .ca-proc-sub { font-size: 11px; color: #4a4a50; margin-top: 2px; }

  @media (max-width: 1024px) {
    .ca-container { flex-direction: column; }
  }
</style>
