<script lang="ts">
  import { onMount } from 'svelte';

  export let artists: { name: string; image?: string }[] = [];

  let artworkMap: Record<string, string> = {};

  function initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  const gradients = [
    'linear-gradient(135deg, #FF4D4D, #FFB84D)',
    'linear-gradient(135deg, #4D7CFF, #FF4D4D)',
    'linear-gradient(135deg, #FFB84D, #4D7CFF)',
    'linear-gradient(135deg, #FF4D4D, #4D7CFF)',
    'linear-gradient(135deg, #4D7CFF, #FFB84D)',
    'linear-gradient(135deg, #FFB84D, #FF4D4D)',
  ];

  onMount(async () => {
    const names = artists.map(a => a.name).filter(Boolean);
    if (!names.length) return;
    try {
      const res = await fetch(`/api/home/artist-artwork?artists=${encodeURIComponent(names.join(','))}`);
      const data = await res.json();
      if (data.artwork) artworkMap = data.artwork;
    } catch {
      // Fallback to gradient avatars
    }
  });

  $: resolvedArtists = artists.slice(0, 8).map(a => ({
    ...a,
    resolvedImage: a.image || artworkMap[a.name] || '',
  }));
</script>

<div class="artist-strip">
  {#each resolvedArtists as artist, i}
    <div class="artist-item">
      {#if artist.resolvedImage}
        <img class="artist-img" src={artist.resolvedImage} alt={artist.name} />
      {:else}
        <div class="artist-fallback" style="background:{gradients[i % gradients.length]}">
          <span>{initial(artist.name)}</span>
        </div>
      {/if}
      <span class="artist-name">{artist.name}</span>
    </div>
  {/each}
</div>

<style>
  .artist-strip {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 0;
    overscroll-behavior-x: contain;
  }
  .artist-strip::-webkit-scrollbar { display: none; }

  .artist-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .artist-img {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-subtle);
    transition: border-color 0.2s, transform 0.2s;
  }
  .artist-img:hover {
    border-color: var(--accent-primary);
    transform: scale(1.08);
  }

  .artist-fallback {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    color: white;
    border: 2px solid var(--border-subtle);
    transition: transform 0.2s;
  }
  .artist-fallback:hover {
    transform: scale(1.08);
  }

  .artist-name {
    font-size: 10px;
    color: var(--text-muted);
    text-align: center;
    max-width: 52px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
