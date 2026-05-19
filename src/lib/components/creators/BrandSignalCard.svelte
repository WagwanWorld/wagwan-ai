<script lang="ts">
  import type { CreatorBrandSignalView } from '$lib/types/creator-signals';

  export let signal: CreatorBrandSignalView;
  export let onMarkSeen: ((id: string) => void) | undefined = undefined;

  $: initials = signal.brand_name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  $: fitColor =
    signal.fit_label === 'Strong fit'
      ? '#22c55e'
      : signal.fit_label === 'Good fit'
        ? '#3b82f6'
        : signal.fit_label === 'Worth exploring'
          ? '#f59e0b'
          : '#94a3b8';

  function handleViewBrand() {
    if (!signal.seen && onMarkSeen) onMarkSeen(signal.id);
  }

  function avatarGradient(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
    const hue1 = Math.abs(h) % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 55%), hsl(${hue2}, 60%, 45%))`;
  }
</script>

<a
  href="/brand/{signal.brand_id}"
  class="bsc-card"
  class:bsc-card--unseen={!signal.seen}
  on:click={handleViewBrand}
>
  {#if !signal.seen}
    <span class="bsc-dot" aria-label="New"></span>
  {/if}

  <div
    class="bsc-avatar"
    style:background={signal.brand_profile_picture ? 'none' : avatarGradient(signal.brand_name)}
  >
    {#if signal.brand_profile_picture}
      <img src={signal.brand_profile_picture} alt={signal.brand_name} class="bsc-avatar-img" />
    {:else}
      <span class="bsc-avatar-initials">{initials}</span>
    {/if}
  </div>

  <div class="bsc-name">{signal.brand_name}</div>
  {#if signal.brand_handle}
    <div class="bsc-handle">@{signal.brand_handle}</div>
  {/if}

  {#if signal.fit_label}
    <span class="bsc-fit" style:background="{fitColor}20" style:color={fitColor}>
      {signal.fit_label}
    </span>
  {/if}

  {#if signal.invite_message}
    <p class="bsc-msg">
      {signal.invite_message.slice(0, 120)}{signal.invite_message.length > 120 ? '…' : ''}
    </p>
  {/if}

  <span class="bsc-cta">View brand</span>
</a>

<style>
  .bsc-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 180px;
    max-width: 200px;
    padding: 20px 16px 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-decoration: none;
    color: inherit;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
    flex-shrink: 0;
  }
  .bsc-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .bsc-card--unseen {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(99, 102, 241, 0.05);
  }
  .bsc-dot {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6366f1;
  }
  .bsc-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .bsc-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  .bsc-avatar-initials {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.5px;
  }
  .bsc-name {
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    line-height: 1.3;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bsc-handle {
    font-size: 12px;
    opacity: 0.5;
    margin-top: -4px;
  }
  .bsc-fit {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 8px;
    letter-spacing: 0.2px;
  }
  .bsc-msg {
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.6;
    text-align: center;
    margin: 2px 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .bsc-cta {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    margin-top: 4px;
  }
</style>
