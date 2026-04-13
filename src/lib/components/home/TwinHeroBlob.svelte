<script lang="ts">
  /** Visual mood of the twin presence — maps to CSS color shifts (no continuous GPU animation). */
  export let state:
    | 'idle'
    | 'focused'
    | 'typing'
    | 'thinking'
    | 'acting'
    | 'success'
    | 'error' = 'idle';

  /** 0–1 — scales micro-motion while user types */
  export let typingEnergy = 0;

  /** After mount, triggers entrance animation */
  export let ready = false;
</script>

<div
  class="twin-blob-root"
  class:twin-blob-root--ready={ready}
  class:twin-blob--idle={state === 'idle'}
  class:twin-blob--focused={state === 'focused'}
  class:twin-blob--typing={state === 'typing'}
  class:twin-blob--thinking={state === 'thinking' || state === 'acting'}
  class:twin-blob--success={state === 'success'}
  class:twin-blob--error={state === 'error'}
  style="--typing-energy: {typingEnergy};"
  aria-hidden="true"
>
  <div class="twin-blob-outer-ring"></div>
  <div class="twin-blob-glow"></div>
  <div class="twin-blob-layer twin-blob-layer--a"></div>
  <div class="twin-blob-layer twin-blob-layer--b"></div>
  <div class="twin-blob-layer twin-blob-layer--c"></div>
  <div class="twin-blob-highlight"></div>
</div>

<style>
  .twin-blob-root {
    position: relative;
    width: min(76vmin, 280px);
    aspect-ratio: 1;
    margin: 0 auto;
    opacity: 0;
    transform: scale(0.94);
    filter: blur(0.5px);
    transition:
      opacity 0.38s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .twin-blob-root--ready {
    opacity: 1;
    transform: scale(1);
  }

  .twin-blob-outer-ring {
    position: absolute;
    inset: -24%;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent);
    box-shadow:
      0 0 40px color-mix(in srgb, var(--accent-soft) 80%, transparent),
      inset 0 0 24px color-mix(in srgb, var(--blob-glow) 40%, transparent);
    opacity: 0.48;
    transform: scale(1);
    pointer-events: none;
  }

  .twin-blob-glow {
    position: absolute;
    inset: -18%;
    border-radius: 50%;
    background: radial-gradient(
      circle at 45% 42%,
      var(--blob-glow) 0%,
      color-mix(in srgb, var(--accent-secondary) 25%, transparent) 42%,
      transparent 68%
    );
    transform: scale(1.03);
    opacity: 0.93;
    pointer-events: none;
  }

  .twin-blob-layer {
    position: absolute;
    inset: 0;
    border-radius: 52% 48% 50% 50% / 50% 50% 50% 50%;
    mix-blend-mode: screen;
    opacity: 0.85;
    transform: rotate(0.8deg) scale(1);
    pointer-events: none;
  }

  .twin-blob-layer--a {
    background:
      radial-gradient(ellipse 85% 70% at 40% 38%, var(--blob-tint-a), transparent 55%),
      radial-gradient(ellipse 70% 85% at 62% 65%, var(--blob-tint-b), transparent 50%),
      radial-gradient(ellipse 55% 50% at 50% 50%, color-mix(in srgb, var(--accent-tertiary) 70%, transparent), transparent 60%);
  }

  .twin-blob-layer--b {
    background:
      radial-gradient(ellipse 80% 72% at 58% 40%, color-mix(in srgb, var(--brand-red) 35%, transparent), transparent 52%),
      radial-gradient(ellipse 65% 80% at 35% 62%, var(--blob-tint-c), transparent 55%);
    transform: rotate(-0.6deg) scale(1);
    opacity: 0.65;
  }

  .twin-blob-layer--c {
    background: radial-gradient(
      circle at 48% 48%,
      color-mix(in srgb, var(--brand-gold) 28%, transparent) 0%,
      color-mix(in srgb, var(--accent-primary) 15%, transparent) 45%,
      transparent 65%
    );
    mix-blend-mode: lighten;
    opacity: 0.55;
    transform: rotate(0.4deg) scale(1);
  }

  .twin-blob-highlight {
    position: absolute;
    inset: 18% 22% 38% 28%;
    border-radius: 50%;
    background: radial-gradient(
      circle at 35% 30%,
      color-mix(in srgb, var(--text-primary) 45%, transparent),
      transparent 62%
    );
    filter: blur(12px);
    opacity: 0.58;
    transform: translate(0, 1%) scale(1.03);
    pointer-events: none;
  }

  /* ── State overlays (color only — no animation timers) ── */
  .twin-blob--focused .twin-blob-glow {
    opacity: 1;
  }

  .twin-blob--typing .twin-blob-layer--b {
    filter: hue-rotate(8deg) saturate(1.08);
  }

  .twin-blob--thinking .twin-blob-layer--a {
    filter: brightness(1.12) saturate(1.12);
  }

  .twin-blob--success .twin-blob-glow {
    background: radial-gradient(
      circle at 45% 42%,
      rgba(255, 200, 160, 0.5) 0%,
      rgba(180, 120, 255, 0.15) 50%,
      transparent 70%
    );
  }

  .twin-blob--success .twin-blob-layer--c {
    opacity: 0.85;
    background: radial-gradient(circle at 48% 48%, rgba(255, 220, 190, 0.35) 0%, transparent 60%);
  }

  .twin-blob-root.twin-blob--error {
    filter: blur(0.5px) saturate(0.72) contrast(0.95);
  }

  .twin-blob--error .twin-blob-layer--a {
    transform: translate(0.5px, -0.5px) skew(0.4deg, -0.2deg) rotate(0.8deg) scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .twin-blob-root {
      transition: opacity 0.2s ease;
    }

    .twin-blob-root--ready {
      transform: scale(1);
    }
  }
</style>
