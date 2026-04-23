<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PostCard from './PostCard.svelte';

  export let posts: Array<{
    gcsUrl: string; mediaType: string; caption: string; hashtags: string[];
    scheduledAt: string; reasoning: string; status: string; igPermalink?: string;
  }> = [];

  const dispatch = createEventDispatcher();

  function updatePost(e: CustomEvent) {
    const { field, value, index } = e.detail;
    posts[index] = { ...posts[index], [field]: value };
    posts = posts;
    dispatch('change', { posts });
  }

  function deletePost(e: CustomEvent) {
    const { index } = e.detail;
    posts = posts.filter((_, i) => i !== index);
    dispatch('change', { posts });
  }
</script>

{#if posts.length === 0}
  <div class="plan-empty">
    <p>No posts in the plan yet. Upload creatives and generate a plan.</p>
  </div>
{:else}
  <div class="plan-list">
    {#each posts as post, i (post.gcsUrl + i)}
      <PostCard
        {...post}
        igPermalink={post.igPermalink || ''}
        index={i}
        on:update={updatePost}
        on:delete={deletePost}
      />
    {/each}
  </div>
{/if}

<style>
  .plan-list { display: flex; flex-direction: column; gap: 12px; }
  .plan-empty {
    text-align: center; padding: 32px;
    border: 1px dashed var(--g-border, rgba(255,255,255,0.06)); border-radius: 14px;
  }
  .plan-empty p { font-size: 14px; color: var(--g-text-3, #4A4A50); margin: 0; }
</style>
