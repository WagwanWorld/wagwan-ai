/**
 * Web Speech API helpers — STT + TTS with graceful degradation.
 */

export type SpeechRecCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function getSpeechRecognition(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getSpeechRecognition();
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakText(text: string, opts?: { rate?: number; pitch?: number; lang?: string }): SpeechSynthesisUtterance | null {
  if (!isSpeechSynthesisSupported() || !text.trim()) return null;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.rate = opts?.rate ?? 1;
  u.pitch = opts?.pitch ?? 1;
  u.lang = opts?.lang ?? 'en-IN';
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

/**
 * Live mic level 0–1 from getUserMedia + AnalyserNode (for orb / UI while dictating).
 * Call stop() when done to release the mic.
 */
export async function startMicLevelMonitor(onLevel: (level01: number) => void): Promise<() => void> {
  if (typeof window === 'undefined') return () => {};
  let raf = 0;
  let stopped = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i]!;
      const raw = s / buf.length / 255;
      const boosted = Math.min(1, Math.pow(raw, 0.65) * 2.4);
      onLevel(boosted);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach(t => t.stop());
      void ctx.close();
      onLevel(0);
    };
  } catch {
    onLevel(0);
    return () => {};
  }
}
