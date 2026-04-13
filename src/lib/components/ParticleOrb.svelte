<script lang="ts">
  import { onMount } from 'svelte';

  /** Pointer tilt -1..1 from LivingOrb */
  export let mx = 0;
  export let my = 0;
  /** Tap pulse 0..1 */
  export let pulseBoost = 0;
  /** Live voice energy 0..1 (drives particle motion while mic is on) */
  export let voiceLevel = 0;

  let canvas: HTMLCanvasElement;
  let reduceMotion = false;

  type Particle = { a: number; r: number; w: number; ph: number; sz: number; col: string };

  let particles: Particle[] = [];
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let raf = 0;
  let ro: ResizeObserver;

  const PALETTE = ['#ffffff', '#e8f4ff', '#b8d9ff', '#7ec8ff', '#5eb3ff', '#4da3ff', '#cfe8ff'];

  function initParticles(count: number, radiusCss: number) {
    const next: Particle[] = [];
    for (let i = 0; i < count; i++) {
      next.push({
        a: Math.random() * Math.PI * 2,
        r: radiusCss * (0.2 + Math.random() * 0.72),
        w: 0.75 + Math.random() * 2.1,
        ph: Math.random() * Math.PI * 2,
        sz: 0.55 + Math.random() * 1.65,
        col: PALETTE[Math.floor(Math.random() * PALETTE.length)]!,
      });
    }
    particles = next;
  }

  function draw(now: number) {
    const ctx = canvas?.getContext('2d');
    if (!ctx || cssW < 4 || cssH < 4) return;

    const wPx = cssW * dpr;
    const hPx = cssH * dpr;
    ctx.clearRect(0, 0, wPx, hPx);

    const cx = wPx / 2;
    const cy = hPx / 2;
    const R = Math.min(cssW, cssH) * dpr * 0.46;
    const t = reduceMotion ? 0 : now * 0.001;
    const breathe = reduceMotion ? 0 : Math.sin(t * 1.15) * 0.025;
    const pulse = pulseBoost * 0.11 + voiceLevel * 0.15;
    const tiltA = mx * 0.22 + my * 0.18;
    const voiceJitter = reduceMotion ? 0 : voiceLevel * R * 0.09;

    for (const p of particles) {
      const jitter = (reduceMotion ? 0 : Math.sin(t * p.w + p.ph) * (R * 0.035)) + voiceJitter;
      const rr = p.r * dpr * (1 + breathe + pulse) + jitter;
      const ang = p.a + (reduceMotion ? 0 : t * 0.072) + tiltA * (p.r / (R / dpr || 1));
      const x = cx + Math.cos(ang) * rr * (1 + mx * 0.055);
      const y = cy + Math.sin(ang) * rr * (1 + my * 0.055);
      const dist = Math.hypot(x - cx, y - cy) / (R || 1);
      const alpha = reduceMotion ? 0.32 : Math.min(0.92, 0.18 + (1 - Math.min(dist, 1.2)) * 0.52);

      ctx.beginPath();
      ctx.arc(x, y, p.sz * dpr * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = p.col;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now: number) {
    if (document.hidden) {
      raf = requestAnimationFrame(frame);
      return;
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  onMount(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setup = () => {
      if (!canvas?.parentElement) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = rect.width;
      cssH = rect.height;
      const floorW = Math.max(1, Math.floor(cssW * dpr));
      const floorH = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== floorW || canvas.height !== floorH) {
        canvas.width = floorW;
        canvas.height = floorH;
      }
      const rCss = (Math.min(cssW, cssH) * 0.46) || 80;
      const targetN = Math.min(400, Math.max(150, Math.floor((cssW * cssH) / 900)));
      if (particles.length !== targetN) initParticles(targetN, rCss);
    };

    ro = new ResizeObserver(() => setup());
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    setup();
    raf = requestAnimationFrame(frame);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  });
</script>

<canvas bind:this={canvas} class="particle-orb-canvas" aria-hidden="true"></canvas>

<style>
  .particle-orb-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    pointer-events: none;
    z-index: 4;
  }
</style>
