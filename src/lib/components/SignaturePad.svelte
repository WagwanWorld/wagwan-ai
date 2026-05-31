<script lang="ts">
  import { onMount } from 'svelte';

  let {
    onSignatureChange,
  }: {
    onSignatureChange?: (dataUrl: string | null) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isDrawing = false;
  let hasSignature = $state(false);

  onMount(() => {
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  });

  function resizeCanvas() {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1C1917';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as MouseEvent).clientX - rect.left,
      y: (e as MouseEvent).clientY - rect.top,
    };
  }

  function startDrawing(e: MouseEvent | TouchEvent) {
    if (!ctx) return;
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing || !ctx) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasSignature = true;
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    if (hasSignature) {
      onSignatureChange?.(canvas.toDataURL('image/png'));
    }
  }

  export function clear() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    onSignatureChange?.(null);
  }

  export function getDataUrl(): string | null {
    if (!hasSignature) return null;
    return canvas.toDataURL('image/png');
  }
</script>

<div class="signature-pad-wrapper">
  <canvas
    bind:this={canvas}
    class="signature-canvas"
    onmousedown={startDrawing}
    onmousemove={draw}
    onmouseup={stopDrawing}
    onmouseleave={stopDrawing}
    ontouchstart={startDrawing}
    ontouchmove={draw}
    ontouchend={stopDrawing}
  ></canvas>
  {#if !hasSignature}
    <p class="signature-placeholder">Sign here</p>
  {/if}
</div>

<style>
  .signature-pad-wrapper {
    position: relative;
    width: 100%;
    height: 160px;
    border: 1.5px solid #d4d4d4;
    border-radius: 10px;
    background: #fafaf9;
    overflow: hidden;
  }

  .signature-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .signature-placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #a3a3a3;
    font-family: 'EB Garamond', Georgia, serif;
    font-style: italic;
    font-size: 1.125rem;
    pointer-events: none;
    user-select: none;
  }
</style>
