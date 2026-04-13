<script lang="ts">
  /** Fixed full-screen background — blurred profile photo + identity accent glow + noise. */
  export let photoUrl: string | null | undefined = null;
  /** Dark immersive mesh (Home) — deeper scrim + aurora-friendly gradient. */
  export let dark = false;
</script>

<div class="persona-bg" class:persona-bg--dark={dark} aria-hidden="true">
  {#if photoUrl}
    <img src={photoUrl} alt="" class="persona-bg__photo" referrerpolicy="no-referrer" />
  {/if}
  <div class="persona-bg__gradient"></div>
  <div class="persona-bg__noise"></div>
</div>

<style>
  .persona-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: var(--bg-primary);
    pointer-events: none;
  }

  .persona-bg__photo {
    position: absolute;
    inset: -10%;
    width: 120%;
    height: 120%;
    object-fit: cover;
    object-position: center top;
    filter: blur(86px) saturate(1.1);
    opacity: 0.16;
    will-change: transform;
  }

  .persona-bg__gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        ellipse 120% 80% at 50% -10%,
        color-mix(in srgb, var(--accent-glow) 60%, rgba(255, 255, 255, 0.4)) 0%,
        transparent 62%
      ),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 0%, rgba(244, 242, 239, 0.86) 100%);
  }

  .persona-bg--dark .persona-bg__photo {
    opacity: 0.22;
    filter: blur(88px) saturate(1.15);
  }

  .persona-bg--dark .persona-bg__gradient {
    background:
      radial-gradient(
        ellipse 100% 70% at 50% -8%,
        color-mix(in srgb, var(--accent-glow) 45%, transparent) 0%,
        transparent 58%
      ),
      radial-gradient(ellipse 70% 50% at 100% 0%, rgba(59, 130, 246, 0.12) 0%, transparent 52%),
      radial-gradient(ellipse 55% 40% at 0% 100%, rgba(168, 85, 247, 0.08) 0%, transparent 48%),
      linear-gradient(to bottom, rgba(8, 10, 14, 0.25) 0%, rgba(8, 10, 14, 0.94) 100%);
  }

  .persona-bg--dark .persona-bg__noise {
    opacity: 0.035;
  }

  /* SVG-based noise overlay */
  .persona-bg__noise {
    position: absolute;
    inset: 0;
    opacity: 0.02;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    background-repeat: repeat;
  }
</style>
