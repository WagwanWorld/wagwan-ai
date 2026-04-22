<script lang="ts">
  export let span: 3 | 4 | 6 | 8 | 12 = 6;
  export let color: string = '';
  export let glowSize: number = 80;
  export let glowX: string = 'right';
  export let glowY: string = 'top';
  export let delay: number = 0;
  export let href: string = '';
  export let expandable: boolean = false;  // if true, card has expand/collapse
  export let expandLabel: string = 'View details';  // footer text when collapsed

  let expanded = false;

  function toggle(e: MouseEvent) {
    // Don't toggle if user clicked a button, link, or input inside the card
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, [role="button"]') && target.closest('button, a, input, textarea, [role="button"]') !== e.currentTarget) {
      return;
    }
    if (expandable) expanded = !expanded;
  }

  const colorMap: Record<string, { bg: string; glow: string }> = {
    red:     { bg: 'var(--g-red)',     glow: 'rgba(255,50,50,0.06)' },
    green:   { bg: 'var(--g-green)',   glow: 'rgba(52,211,153,0.06)' },
    indigo:  { bg: 'var(--g-indigo)',  glow: 'rgba(99,102,241,0.06)' },
    amber:   { bg: 'var(--g-amber)',   glow: 'rgba(251,191,36,0.06)' },
    rose:    { bg: 'var(--g-rose)',    glow: 'rgba(244,63,94,0.035)' },
    blue:    { bg: 'var(--g-blue)',    glow: 'rgba(59,130,246,0.03)' },
    teal:    { bg: 'var(--g-teal)',    glow: 'rgba(20,184,166,0.03)' },
    purple:  { bg: 'var(--g-purple)',  glow: 'rgba(168,85,247,0.03)' },
    emerald: { bg: 'var(--g-emerald)', glow: 'rgba(16,185,129,0.03)' },
    gold:    { bg: 'var(--g-gold)',    glow: 'rgba(245,158,11,0.025)' },
  };

  $: c = colorMap[color] || { bg: 'var(--g-card-bg)', glow: 'rgba(255,255,255,0.03)' };
  $: glowPos = `${glowY === 'top' ? 'top: -28px' : 'bottom: -28px'}; ${glowX === 'right' ? 'right: -28px' : 'left: -28px'}`;
</script>

<div
  class="gc gc-s{span}"
  class:gc-expanded={expanded}
  style="animation-delay: {delay}s;"
  role={href ? 'link' : 'button'}
  tabindex="0"
  on:click={toggle}
  on:keydown={(e) => e.key === 'Enter' && toggle()}
>
  <div class="gc-edge"></div>
  <div class="gc-glow" style="width: {glowSize}px; height: {glowSize}px; background: {c.glow}; {glowPos}"></div>

  <!-- Summary (always visible) -->
  <div class="gc-content">
    <slot />
  </div>

  <!-- Expand footer -->
  {#if expandable && !expanded}
    <div class="gc-expand-hint">{expandLabel} &rarr;</div>
  {/if}

  <!-- Expanded detail -->
  {#if expandable && expanded}
    <div class="gc-detail">
      <div class="gc-detail-divider"></div>
      <slot name="expanded" />
      <button class="gc-collapse" on:click|stopPropagation={() => expanded = false}>Collapse</button>
    </div>
  {/if}
</div>

<style>
  .gc {
    position: relative;
    overflow: hidden;
    border-radius: var(--g-card-radius, 22px);
    padding: 22px 24px;
    border: 1px solid var(--g-card-border, rgba(255,255,255,0.04));
    box-shadow:
      0 1px 0 0 var(--g-card-highlight, rgba(255,255,255,0.03)) inset,
      0 -1px 0 0 var(--g-card-shadow-bottom, rgba(0,0,0,0.15)) inset,
      var(--g-card-shadow-near, 0 4px 16px rgba(0,0,0,0.12)),
      var(--g-card-shadow-far, 0 12px 40px rgba(0,0,0,0.08));
    backdrop-filter: blur(var(--g-card-blur, 24px));
    -webkit-backdrop-filter: blur(var(--g-card-blur, 24px));
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition:
      border-color var(--g-dur, 0.7s) var(--g-ease, cubic-bezier(0.22,1,0.36,1)),
      box-shadow var(--g-dur, 0.7s) var(--g-ease, cubic-bezier(0.22,1,0.36,1));
    opacity: 0;
    animation: gc-enter 0.7s var(--g-ease, cubic-bezier(0.22,1,0.36,1)) forwards;
  }

  .gc:hover {
    border-color: var(--g-card-border-hover, rgba(255,255,255,0.065));
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.04) inset,
      0 -1px 0 0 rgba(0,0,0,0.12) inset,
      var(--g-card-shadow-hover-near, 0 6px 20px rgba(0,0,0,0.15)),
      var(--g-card-shadow-hover-far, 0 20px 50px rgba(0,0,0,0.12));
  }

  .gc:hover .gc-glow { opacity: 0.65; }

  @keyframes gc-enter {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Top edge highlight */
  .gc-edge {
    position: absolute;
    top: 0; left: 16px; right: 16px; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
    pointer-events: none;
  }

  /* Inner light on hover */
  .gc::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: var(--g-card-radius, 22px);
    background: linear-gradient(145deg, rgba(255,255,255,0.015), transparent 45%);
    opacity: 0;
    transition: opacity var(--g-dur, 0.7s);
    pointer-events: none;
  }
  .gc:hover::after { opacity: 1; }

  /* Glow orb */
  .gc-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(55px);
    pointer-events: none;
    opacity: 0.3;
    transition: opacity 0.8s var(--g-ease, cubic-bezier(0.22,1,0.36,1));
  }

  /* Content */
  .gc-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Grid spans */
  .gc-s3 { grid-column: span 3; min-height: 148px; }
  .gc-s4 { grid-column: span 4; min-height: 168px; }
  .gc-s6 { grid-column: span 6; min-height: 210px; }
  .gc-s8 { grid-column: span 8; }
  .gc-s12 { grid-column: span 12; }

  /* Expanded state — takes full width */
  .gc-expanded { grid-column: span 12 !important; min-height: auto; }
  .gc-expanded .gc-glow { opacity: 0.5; }

  /* Expand hint footer */
  .gc-expand-hint {
    margin-top: auto;
    padding-top: 16px;
    font-size: 11px;
    color: rgba(255,255,255,0.1);
    letter-spacing: 0.02em;
    transition: color 0.6s var(--g-ease), letter-spacing 0.6s var(--g-ease);
  }
  .gc:hover .gc-expand-hint { color: rgba(255,255,255,0.28); letter-spacing: 0.04em; }

  /* Detail panel */
  .gc-detail {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: detail-enter 0.5s var(--g-ease) both;
  }
  @keyframes detail-enter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .gc-detail-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
    margin: 8px 0;
  }
  .gc-collapse {
    align-self: flex-start;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 6px 14px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.02);
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    font-family: inherit;
    transition: color 0.5s, background 0.5s, border-color 0.5s;
    margin-top: 8px;
  }
  .gc-collapse:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.06); }

  @media (max-width: 900px) {
    .gc-s3 { grid-column: span 2; }
    .gc-s4 { grid-column: span 2; }
    .gc-s6 { grid-column: span 4; }
    .gc-s8 { grid-column: span 4; }
    .gc-s12 { grid-column: span 4; }
    .gc-expanded { grid-column: span 4 !important; }
  }
  @media (max-width: 600px) {
    .gc-s3, .gc-s4 { grid-column: span 1; }
    .gc-s6, .gc-s8, .gc-s12 { grid-column: span 2; }
    .gc-expanded { grid-column: span 2 !important; }
  }
</style>
