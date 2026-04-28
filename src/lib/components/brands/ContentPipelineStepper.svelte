<script lang="ts">
  export let currentStep: 'upload' | 'generate' | 'review' | 'schedule' | 'post' = 'upload';

  const steps = [
    { id: 'upload', label: 'Upload', num: '1' },
    { id: 'generate', label: 'Generate', num: '2' },
    { id: 'review', label: 'Review', num: '3' },
    { id: 'schedule', label: 'Schedule', num: '4' },
    { id: 'post', label: 'Post', num: '5' },
  ] as const;

  $: currentIdx = steps.findIndex((s) => s.id === currentStep);

  function stepState(idx: number): 'done' | 'active' | 'inactive' {
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'active';
    return 'inactive';
  }
</script>

<div class="ca-stepper">
  {#each steps as step, i}
    {#if i > 0}
      <div class="ca-step-connector" class:ca-step-connector--done={i <= currentIdx}></div>
    {/if}
    <div class="ca-step">
      <div class="ca-step-num ca-step-num--{stepState(i)}">
        {#if stepState(i) === 'done'}&#10003;{:else}{step.num}{/if}
      </div>
      <span class="ca-step-label ca-step-label--{stepState(i)}">{step.label}</span>
    </div>
  {/each}
</div>

<style>
  .ca-stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 0 24px;
    margin-bottom: 8px;
  }
  .ca-step {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ca-step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .ca-step-num--active {
    background: rgba(232, 70, 74, 0.15);
    border: 1.5px solid rgba(232, 70, 74, 0.5);
    color: #e8464a;
  }
  .ca-step-num--inactive {
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    color: #4a4a50;
  }
  .ca-step-num--done {
    background: rgba(74, 222, 128, 0.1);
    border: 1.5px solid rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }
  .ca-step-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: color 0.2s ease;
  }
  .ca-step-label--active { color: #e8464a; }
  .ca-step-label--inactive { color: #4a4a50; }
  .ca-step-label--done { color: #4ade80; }
  .ca-step-connector {
    width: 48px;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 12px;
    transition: background 0.2s ease;
  }
  .ca-step-connector--done {
    background: rgba(74, 222, 128, 0.3);
  }

  @media (max-width: 640px) {
    .ca-step-label { display: none; }
    .ca-step-connector { width: 20px; margin: 0 4px; }
  }
</style>
