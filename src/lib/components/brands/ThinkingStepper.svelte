<script lang="ts">
  import { onMount } from 'svelte';

  export let steps: Array<{ key: string; label: string }> = [
    { key: 'brief', label: 'Understanding your brand' },
    { key: 'scoring', label: 'Scanning creator signals' },
    { key: 'matching', label: 'Matching to your audience' },
    { key: 'done', label: 'Building your shortlist' },
  ];

  export let activeStep: string = '';
  export let completedSteps: Set<string> = new Set();

  let mounted = false;
  onMount(() => { setTimeout(() => { mounted = true; }, 100); });

  $: activeIdx = steps.findIndex(s => s.key === activeStep);

  // Floating avatar data — these "fly in" to represent creators being scanned
  const avatars = [
    { initial: 'A', x: -140, y: -120, delay: 0.3, grad: '#FF4D4D, #FFB84D' },
    { initial: 'P', x: 160, y: -80, delay: 0.6, grad: '#4D7CFF, #FF4D4D' },
    { initial: 'R', x: -180, y: 40, delay: 0.9, grad: '#FFB84D, #4D7CFF' },
    { initial: 'S', x: 140, y: 100, delay: 1.2, grad: '#FF4D4D, #4D7CFF' },
    { initial: 'V', x: -60, y: 140, delay: 1.5, grad: '#4D7CFF, #FFB84D' },
    { initial: 'M', x: 100, y: -140, delay: 0.5, grad: '#FFB84D, #FF4D4D' },
    { initial: 'K', x: -120, y: -40, delay: 0.8, grad: '#4D7CFF, #FFB84D' },
    { initial: 'N', x: 80, y: 60, delay: 1.1, grad: '#FF4D4D, #FFB84D' },
  ];
</script>

<div class="stepper-root" class:mounted>
  <!-- Floating avatars converging to center -->
  <div class="avatar-field" aria-hidden="true">
    {#each avatars as av}
      <div
        class="floating-avatar"
        style="
          --start-x: {av.x}px;
          --start-y: {av.y}px;
          --delay: {av.delay}s;
          background: linear-gradient(135deg, {av.grad});
        "
      >
        <span>{av.initial}</span>
      </div>
    {/each}
    <!-- Center pulse -->
    <div class="center-pulse"></div>
  </div>

  <div class="stepper-content">
    <h2 class="stepper-title">Finding your audience</h2>
    <p class="stepper-sub">Scanning {avatars.length * 100}+ creator portraits</p>

    <div class="stepper-list">
      {#each steps as step, i}
        {@const isDone = completedSteps.has(step.key)}
        {@const isActive = step.key === activeStep}
        <div
          class="step"
          class:step--done={isDone}
          class:step--active={isActive}
          style="animation-delay: {i * 0.15}s"
        >
          <div class="step-indicator">
            {#if isDone}
              <div class="step-check">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.5l3 3L10 3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            {:else if isActive}
              <div class="step-ring">
                <div class="step-ring-inner"></div>
              </div>
            {:else}
              <div class="step-dot"></div>
            {/if}
          </div>
          <span class="step-label">{step.label}{isDone ? '' : '...'}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .stepper-root {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 24px;
    position: relative;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .stepper-root.mounted { opacity: 1; }

  /* ── Floating avatars ── */
  .avatar-field {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .floating-avatar {
    position: absolute;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: white;
    opacity: 0;
    transform: translate(var(--start-x), var(--start-y)) scale(0.5);
    animation: avatar-converge 3s cubic-bezier(0.32, 0.72, 0, 1) var(--delay) infinite;
  }

  @keyframes avatar-converge {
    0% {
      opacity: 0;
      transform: translate(var(--start-x), var(--start-y)) scale(0.5);
    }
    20% {
      opacity: 0.7;
    }
    60% {
      opacity: 0.4;
      transform: translate(calc(var(--start-x) * 0.2), calc(var(--start-y) * 0.2)) scale(0.8);
    }
    80% {
      opacity: 0;
      transform: translate(0, 0) scale(0.3);
    }
    100% {
      opacity: 0;
      transform: translate(var(--start-x), var(--start-y)) scale(0.5);
    }
  }

  .center-pulse {
    position: absolute;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(77, 124, 255, 0.15), transparent 70%);
    animation: pulse-glow 2s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.5); opacity: 1; }
  }

  /* ── Content ── */
  .stepper-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 360px;
    width: 100%;
    padding: 40px 32px;
    border-radius: 1.25rem;
    background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border-subtle);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04), 0 16px 48px rgba(0,0,0,0.3);
  }

  .stepper-title {
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .stepper-sub {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    margin: -16px 0 0;
    font-family: var(--font-mono);
  }

  /* ── Steps ── */
  .stepper-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0.3;
    transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);
    animation: step-in 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  .step--done { opacity: 0.7; }
  .step--active { opacity: 1; }

  @keyframes step-in {
    from { opacity: 0; transform: translateX(-8px); }
    to { transform: translateX(0); }
  }

  .step-indicator {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--glass-medium);
  }

  .step-check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: check-pop 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes check-pop {
    from { transform: scale(0); }
    50% { transform: scale(1.2); }
    to { transform: scale(1); }
  }

  .step-ring {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(77, 124, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ring-rotate 1.2s linear infinite;
  }

  .step-ring-inner {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-secondary);
    animation: ring-pulse 1.2s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  @keyframes ring-rotate {
    to { transform: rotate(360deg); }
  }

  @keyframes ring-pulse {
    0%, 100% { opacity: 0.5; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }

  .step-label {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .step--done .step-label {
    color: var(--text-secondary);
  }
</style>
