<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ParticleOrb from './ParticleOrb.svelte';

  /** Diameter as % of the smaller viewport dimension (feels full-screen) */
  export let scale = 78;
  export let showCaption = true;
  /** Override default hint under the orb */
  export let caption: string | null = null;
  /** Extra pulse intensity 0–1 (e.g. after tap) */
  let pulseBoost = 0;
  /** Mic / dictation active — listening ring + stronger motion */
  export let voiceActive = false;
  /** Normalized mic level 0–1 while speaking */
  export let voiceLevel = 0;

  const dispatch = createEventDispatcher<{ interact: void }>();

  let stage: HTMLDivElement;
  let mx = 0;
  let my = 0;
  let pressed = false;

  function onPointerMove(e: PointerEvent) {
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const nx = (e.clientX - cx) / (r.width / 2);
    const ny = (e.clientY - cy) / (r.height / 2);
    mx = Math.max(-1, Math.min(1, nx));
    my = Math.max(-1, Math.min(1, ny));
  }

  function resetTilt() {
    mx = 0;
    my = 0;
  }

  function onPointerDown() {
    pressed = true;
  }

  function onPointerUp() {
    pressed = false;
  }

  function onClick() {
    pulseBoost = 1;
    dispatch('interact');
    const t = window.setTimeout(() => {
      pulseBoost = 0;
      window.clearTimeout(t);
    }, 550);
  }

  $: tiltX = my * -14;
  $: tiltY = mx * 14;
  $: parallaxX = mx * 8;
  $: parallaxY = my * 8;
  $: voiceScale = voiceLevel * 0.14;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={stage}
  class="living-orb-stage"
  on:pointermove={onPointerMove}
  on:pointerleave={resetTilt}
  on:pointerdown={onPointerDown}
  on:pointerup={onPointerUp}
  on:pointercancel={onPointerUp}
  on:click={onClick}
  role="button"
  tabindex="0"
  aria-label="Your twin — tap to ask something"
  on:keydown={e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }}
>
  <div
    class="orb-aura"
    class:pressed
    class:voice-active={voiceActive}
    style="--pulse: {pulseBoost}; --voice: {voiceScale}; --tilt-x: {tiltX}deg; --tilt-y: {tiltY}deg; --px: {parallaxX}px; --py: {parallaxY}px; --d: min({scale}vmin, 92vw);"
  >
    <div class="orb-shell">
      <div class="orb-magma" aria-hidden="true"></div>
      <div class="orb-core"></div>
      <div class="orb-shine"></div>
      <ParticleOrb {mx} {my} pulseBoost={pulseBoost} {voiceLevel} />
      <div class="orb-rim"></div>
    </div>
  </div>
  {#if showCaption}
    <p class="orb-caption">{caption ?? 'Type or tap the mic — I’m listening'}</p>
  {/if}
</div>

<style>
  .living-orb-stage {
    position: relative;
    width: 100%;
    min-height: min(72vh, 520px);
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .orb-aura {
    position: relative;
    width: var(--d);
    height: var(--d);
    max-width: 420px;
    max-height: 420px;
    transform-style: preserve-3d;
    perspective: 900px;
    transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))
      scale(calc(1 + var(--pulse, 0) * 0.06 + var(--voice, 0)));
    transition: transform 0.12s ease-out;
  }

  .orb-aura.voice-active {
    filter: drop-shadow(0 0 24px color-mix(in srgb, var(--accent-primary) 38%, transparent))
      drop-shadow(0 0 48px color-mix(in srgb, var(--accent-glow) 55%, transparent));
  }

  .orb-aura.pressed {
    transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) scale(0.96);
  }

  .orb-aura.pressed.voice-active {
    filter: drop-shadow(0 0 20px color-mix(in srgb, var(--accent-primary) 32%, transparent));
  }

  .orb-shell {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    overflow: hidden;
    transform-style: preserve-3d;
    animation: orb-breathe 4.2s ease-in-out infinite;
    box-shadow:
      0 0 64px color-mix(in srgb, var(--accent-glow) 70%, transparent),
      0 0 120px color-mix(in srgb, var(--accent-soft) 90%, transparent),
      inset 0 -20px 48px color-mix(in srgb, var(--accent-tertiary) 18%, transparent);
  }

  @keyframes orb-breathe {
    0%,
    100% {
      transform: scale(0.97) translateZ(0);
      filter: brightness(1) saturate(1.05);
    }
    50% {
      transform: scale(1.035) translateZ(0);
      filter: brightness(1.12) saturate(1.15);
    }
  }

  .orb-magma {
    position: absolute;
    inset: -10%;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      color-mix(in srgb, var(--bg-secondary) 95%, var(--accent-tertiary)),
      color-mix(in srgb, var(--accent-soft) 85%, var(--bg-elevated)),
      color-mix(in srgb, var(--accent-primary) 35%, var(--bg-elevated)),
      #dbeafe,
      #eff6ff,
      color-mix(in srgb, var(--accent-secondary) 40%, #e0e7ff),
      color-mix(in srgb, var(--bg-secondary) 95%, var(--accent-tertiary))
    );
    opacity: 0.42;
    filter: blur(22px);
    animation: orb-spin 32s linear infinite;
    pointer-events: none;
    z-index: 0;
  }

  @keyframes orb-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .orb-core {
    position: absolute;
    inset: 4%;
    border-radius: 50%;
    z-index: 1;
    background:
      radial-gradient(
        ellipse 82% 72% at calc(50% + var(--px)) calc(40% + var(--py)),
        rgba(255, 255, 255, 0.72),
        transparent 50%
      ),
      radial-gradient(
        circle at 28% 26%,
        color-mix(in srgb, var(--accent-soft) 90%, transparent),
        transparent 46%
      ),
      radial-gradient(
        circle at 72% 66%,
        color-mix(in srgb, var(--accent-primary) 28%, transparent),
        transparent 48%
      ),
      radial-gradient(
        circle at 50% 100%,
        color-mix(in srgb, var(--accent-tertiary) 22%, var(--bg-secondary)),
        transparent 54%
      ),
      radial-gradient(
        circle at 50% 50%,
        color-mix(in srgb, var(--bg-elevated) 82%, var(--accent-secondary)),
        color-mix(in srgb, var(--bg-secondary) 88%, var(--accent-tertiary))
      );
  }

  .orb-shine {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    z-index: 2;
    background: radial-gradient(
      circle at calc(36% + var(--px) * 0.5) calc(28% + var(--py) * 0.5),
      rgba(255, 255, 255, 0.5) 0%,
      rgba(200, 230, 255, 0.12) 20%,
      transparent 44%
    );
    pointer-events: none;
    mix-blend-mode: soft-light;
    animation: shine-pulse 3.2s ease-in-out infinite;
  }

  @keyframes shine-pulse {
    0%,
    100% {
      opacity: 0.88;
    }
    50% {
      opacity: 1;
    }
  }

  .orb-rim {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    z-index: 5;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bg-elevated) 55%, var(--accent-soft));
    pointer-events: none;
  }

  .orb-caption {
    margin: 28px 24px 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: center;
    pointer-events: none;
    user-select: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .orb-shell {
      animation: none;
    }
    .orb-magma {
      animation: none;
    }
    .orb-shine {
      animation: none;
    }
    .orb-aura {
      transform: none;
    }
    .orb-aura.voice-active {
      filter: none;
    }
  }
</style>
