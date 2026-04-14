<script lang="ts">
  export let steps: Array<{ key: string; label: string }> = [
    { key: 'brief', label: 'Understanding your brand' },
    { key: 'scoring', label: 'Analyzing creator signals' },
    { key: 'matching', label: 'Matching to your audience' },
    { key: 'done', label: 'Building your campaign plan' },
  ];

  export let activeStep: string = '';
  export let completedSteps: Set<string> = new Set();

  $: activeIdx = steps.findIndex(s => s.key === activeStep);
</script>

<div class="stepper-root">
  <div class="stepper-card">
    <h2 class="stepper-title">Finding your audience</h2>

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
              <svg class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 4" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {:else if isActive}
              <div class="step-spinner"></div>
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
  }

  .stepper-card {
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 360px;
    width: 100%;
  }

  .stepper-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    text-align: center;
    letter-spacing: -0.01em;
  }

  .stepper-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0.35;
    transition: opacity 0.4s ease;
    animation: step-in 0.4s ease-out both;
  }

  .step--done {
    opacity: 0.6;
  }

  .step--active {
    opacity: 1;
  }

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
    background: var(--glass-strong);
  }

  .step-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--glass-strong);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .check-icon {
    animation: check-pop 0.3s ease-out;
  }

  @keyframes check-pop {
    from { transform: scale(0); }
    50% { transform: scale(1.2); }
    to { transform: scale(1); }
  }

  .step-label {
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .step--done .step-label {
    color: var(--text-secondary);
  }
</style>
