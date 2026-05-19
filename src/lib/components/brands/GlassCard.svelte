<script lang="ts">
  export let span: 3 | 4 | 6 | 8 | 12 = 6;
  export let color: string = '';
  export let glowSize: number = 80;
  export let glowX: string = 'right';
  export let glowY: string = 'top';
  export let delay: number = 0;
  export let href: string = '';
  export let expandable: boolean = false;
  export let expandLabel: string = '';
</script>

<div class="gc gc-s{span}">
  <div class="gc-content">
    <slot />
  </div>
</div>

<style>
  .gc {
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    padding: 18px 16px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.035);
    display: flex;
    flex-direction: column;
    min-width: 0;
    word-break: break-word;
  }

  .gc:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .gc-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  /* Grid spans — 3-col bento */
  .gc-s3 {
    grid-column: span 1;
  }
  .gc-s4 {
    grid-column: span 1;
  }
  .gc-s6 {
    grid-column: span 1;
  }
  .gc-s8 {
    grid-column: span 2;
  }
  .gc-s12 {
    grid-column: 1 / -1;
  }

  @media (max-width: 1024px) {
    .gc-s3,
    .gc-s4 {
      grid-column: span 1;
    }
    .gc-s6 {
      grid-column: span 1;
    }
    .gc-s8 {
      grid-column: 1 / -1;
    }
    .gc-s12 {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 640px) {
    .gc-s3,
    .gc-s4,
    .gc-s6,
    .gc-s8,
    .gc-s12 {
      grid-column: 1 / -1;
    }
  }
</style>
