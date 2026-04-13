<script lang="ts">
  export let state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'thoughtful' | 'sorry' | 'concerned' = 'idle';
  /** Optional mood from model: warm|excited|thoughtful|neutral|sorry */
  export let mood: string | undefined = undefined;
  export let compact = false;

  $: effective = (() => {
    if (mood === 'sorry') return 'sorry';
    if (mood === 'thoughtful' || mood === 'warm') return 'thoughtful';
    if (mood === 'excited') return 'happy';
    return state;
  })();

  $: size = compact ? 72 : 112;
  $: ringPulse = effective === 'listening';
  $: mouthOpen = effective === 'speaking' || effective === 'happy';
  $: sweat = effective === 'thinking';
  $: tint =
    effective === 'sorry' || effective === 'concerned'
      ? 'rgba(100,120,200,0.35)'
      : effective === 'happy'
        ? 'rgba(255,200,120,0.25)'
        : 'rgba(229,0,26,0.2)';
</script>

<div
  class="twin-wrap"
  class:compact
  style="--twin-size:{size}px;--twin-tint:{tint};"
  aria-hidden="true"
>
  <div class="ring" class:pulse={ringPulse}></div>
  <div class="orb">
    <div class="face">
      <div class="brow left" class:raise={effective === 'happy'}></div>
      <div class="brow right" class:raise={effective === 'happy'}></div>
      <div class="eye left"></div>
      <div class="eye right"></div>
      <div class="cheek left"></div>
      <div class="cheek right"></div>
      <div class="mouth" class:open={mouthOpen} class:frown={effective === 'sorry' || effective === 'concerned'}></div>
      {#if sweat}
        <div class="spark spark-a"></div>
        <div class="spark spark-b"></div>
      {/if}
    </div>
  </div>
</div>

<style>
  .twin-wrap {
    position: relative;
    width: var(--twin-size);
    height: var(--twin-size);
    flex-shrink: 0;
  }
  .ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid rgba(229, 0, 26, 0.25);
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .ring.pulse {
    border-color: rgba(229, 0, 26, 0.55);
    transform: scale(1.04);
  }
  .orb {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background:
      radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.78), transparent 46%),
      radial-gradient(circle at 70% 72%, var(--twin-tint), transparent 54%),
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--bg-elevated) 90%, var(--accent-soft)),
        color-mix(in srgb, var(--bg-secondary) 72%, var(--accent-tertiary) 10%)
      );
    box-shadow:
      0 12px 36px color-mix(in srgb, var(--text-primary) 11%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .face {
    position: relative;
    width: 58%;
    height: 48%;
    margin-top: 6%;
  }
  .brow {
    position: absolute;
    top: 0;
    width: 28%;
    height: 3px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text-primary) 30%, transparent);
    transition: transform 0.2s ease;
  }
  .brow.left {
    left: 4%;
    transform: rotate(-8deg);
  }
  .brow.right {
    right: 4%;
    transform: rotate(8deg);
  }
  .brow.raise {
    transform: translateY(-2px) rotate(0deg);
  }
  .eye {
    position: absolute;
    top: 22%;
    width: 18%;
    padding-bottom: 22%;
    height: 0;
    border-radius: 50%;
    background: var(--text-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--bg-elevated) 65%, transparent);
  }
  .eye.left {
    left: 10%;
  }
  .eye.right {
    right: 10%;
  }
  .cheek {
    position: absolute;
    top: 48%;
    width: 14%;
    padding-bottom: 10%;
    height: 0;
    border-radius: 50%;
    background: rgba(229, 0, 26, 0.12);
    opacity: 0.9;
  }
  .cheek.left {
    left: 0;
  }
  .cheek.right {
    right: 0;
  }
  .mouth {
    position: absolute;
    bottom: 6%;
    left: 50%;
    transform: translateX(-50%);
    width: 36%;
    height: 5px;
    border-radius: 0 0 10px 10px;
    background: color-mix(in srgb, var(--text-primary) 22%, transparent);
    transition: height 0.15s ease, border-radius 0.15s ease;
  }
  .mouth.open {
    height: 14px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--text-primary) 88%, transparent);
    box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.35);
  }
  .mouth.frown {
    border-radius: 10px 10px 0 0;
    height: 5px;
    bottom: 4%;
    background: color-mix(in srgb, var(--text-primary) 20%, transparent);
  }
  .spark {
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    opacity: 0.75;
  }
  .spark-a {
    top: 8%;
    right: 12%;
  }
  .spark-b {
    top: 18%;
    right: 4%;
  }
  .compact .face {
    width: 56%;
    height: 46%;
  }
</style>
