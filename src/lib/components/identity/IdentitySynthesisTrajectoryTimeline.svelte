<script lang="ts">
  import type { IdentitySynthesisTrajectory } from '$lib/types/identitySynthesis';
  import { hashString, verticalBarGradient } from '$lib/identity/visualIdentity';

  export let trajectory: IdentitySynthesisTrajectory;

  $: lineGradient = verticalBarGradient(
    hashString(
      `${trajectory.short_term}|${trajectory.long_term_potential}|${trajectory.hidden_opportunities}`,
    ),
  );

  $: nodes = [
    ...(trajectory.short_term?.trim()
      ? [{ title: 'Now' as const, body: trajectory.short_term.trim() }]
      : []),
    ...(trajectory.long_term_potential?.trim()
      ? [{ title: 'North star' as const, body: trajectory.long_term_potential.trim() }]
      : []),
    ...(trajectory.hidden_opportunities?.trim()
      ? [{ title: 'Leverage' as const, body: trajectory.hidden_opportunities.trim() }]
      : []),
  ];
</script>

<section class="iv-block" aria-labelledby="iv-traj-h">
  <h3 id="iv-traj-h" class="iv-block__h">Trajectory</h3>
  {#if nodes.length}
    <div class="iv-traj">
      <div class="iv-traj__line" style:background={lineGradient} aria-hidden="true"></div>
      <div class="iv-traj__nodes">
        {#each nodes as n}
          <div class="iv-traj__node">
            <span class="iv-traj__dot"></span>
            <p class="iv-traj__title">{n.title}</p>
            <p class="iv-traj__body">{n.body}</p>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .iv-block {
    margin: 0;
  }

  .iv-block__h {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
    margin: 0 0 0.85rem;
  }

  .iv-traj {
    position: relative;
    padding: 4px 0 4px 4px;
  }

  .iv-traj__line {
    position: absolute;
    left: 9px;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 999px;
  }

  .iv-traj__nodes {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding-left: 28px;
  }

  .iv-traj__node {
    position: relative;
  }

  .iv-traj__dot {
    position: absolute;
    left: -22px;
    top: 4px;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--iv-surface-2, #fff);
    border: 2px solid #1a1a1a;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.95);
  }

  .iv-traj__title {
    margin: 0 0 0.25rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-traj__body {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--iv-text, #14120f);
  }
</style>
