<!-- Full-viewport BRBY mesh; pointer-events none. Opacity/blur from CSS tokens + surface scale. -->
<div class="ambient-mesh" aria-hidden="true">
  <div class="ambient-mesh__orb ambient-mesh__orb--blue"></div>
  <div class="ambient-mesh__orb ambient-mesh__orb--red"></div>
  <div class="ambient-mesh__orb ambient-mesh__orb--gold"></div>
</div>

<style>
  .ambient-mesh {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .ambient-mesh__orb {
    position: absolute;
    border-radius: 50%;
    opacity: calc(var(--mesh-orb-base-opacity, 0.32) * var(--mesh-orb-opacity-scale, 1));
    filter: blur(calc(48px * var(--mesh-blur-scale, 1)));
    animation: ambient-mesh-drift 18s ease-in-out infinite;
  }

  .ambient-mesh__orb--red {
    animation-duration: 22s;
    animation-direction: reverse;
  }

  .ambient-mesh__orb--gold {
    animation-duration: 26s;
  }

  .ambient-mesh__orb--blue {
    width: min(55vw, 520px);
    height: min(55vw, 520px);
    left: -8%;
    top: 15%;
    background: radial-gradient(circle, var(--ambient-blue) 0%, transparent 70%);
  }

  .ambient-mesh__orb--red {
    width: min(45vw, 420px);
    height: min(45vw, 420px);
    right: -5%;
    top: 45%;
    background: radial-gradient(circle, var(--ambient-red) 0%, transparent 70%);
  }

  .ambient-mesh__orb--gold {
    width: min(40vw, 380px);
    height: min(40vw, 380px);
    left: 35%;
    bottom: -10%;
    background: radial-gradient(circle, var(--ambient-gold) 0%, transparent 70%);
  }

  @keyframes ambient-mesh-drift {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(1.5%, -1%) scale(1.02);
    }
    66% {
      transform: translate(-1%, 1.5%) scale(0.99);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ambient-mesh__orb {
      animation: none;
      opacity: calc(var(--mesh-orb-base-opacity, 0.32) * var(--mesh-orb-opacity-scale, 1) * 0.75);
    }
  }
</style>
