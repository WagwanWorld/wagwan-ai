/**
 * Client-side visuals for identity synthesis (text payload → stable images / gradients).
 * Images: Picsum Photos seeded URLs — deterministic per string, no API key.
 * https://picsum.photos/
 */

export type ImageAspect = 'square' | 'wide' | 'tall';

/** FNV-1a 32-bit hash for stable seeds */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function dims(aspect: ImageAspect): [number, number] {
  switch (aspect) {
    case 'wide':
      return [640, 360];
    case 'tall':
      return [360, 520];
    default:
      return [400, 400];
  }
}

/**
 * Deterministic placeholder image (Picsum seed). Use for decorative imagery only.
 */
export function imageUrlForKeyword(keyword: string, aspect: ImageAspect = 'square'): string {
  const seed = `iv-${keyword.trim().toLowerCase()}-${aspect}`;
  const [w, h] = dims(aspect);
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function imageUrlFromSeed(seedNum: number, aspect: ImageAspect = 'square'): string {
  const [w, h] = dims(aspect);
  return `https://picsum.photos/seed/${seedNum}/${w}/${h}`;
}

/** CSS gradient for hero / timeline — works on light or dark shells */
export function gradientFromSeed(seed: number, lightMode = true): string {
  const h1 = seed % 360;
  const h2 = (seed * 17 + 41) % 360;
  if (lightMode) {
    return `linear-gradient(145deg, hsl(${h1} 42% 94%) 0%, hsl(${h2} 28% 88%) 48%, hsl(${(h1 + 40) % 360} 35% 90%) 100%)`;
  }
  return `linear-gradient(145deg, hsl(${h1} 45% 18%) 0%, hsl(${h2} 35% 12%) 100%)`;
}

/** Vertical gradient for timeline bar */
export function verticalBarGradient(seed: number): string {
  const h1 = seed % 360;
  const h2 = (seed * 23 + 11) % 360;
  return `linear-gradient(180deg, hsl(${h1} 35% 42%) 0%, hsl(${h2} 28% 58%) 100%)`;
}

const COLOR_WORDS: Record<string, string> = {
  black: '#1a1a1a',
  white: '#f5f5f0',
  off: '#f0ebe3',
  cream: '#faf6ef',
  ivory: '#fffff0',
  charcoal: '#2d2d2d',
  terracotta: '#c4725c',
  sage: '#9caf88',
  olive: '#708238',
  navy: '#1e2a4a',
  cobalt: '#0047ab',
  blush: '#de5d83',
  rust: '#b7410e',
  sand: '#d4c4a8',
  stone: '#8b8680',
  moss: '#5c6b4a',
  wine: '#722f37',
  gold: '#c5a059',
  copper: '#b87333',
  neon: '#39ff14',
  slate: '#5c6670',
};

export interface ColorSwatch {
  label: string;
  css: string;
}

const HEX_INLINE = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i;

/** Map palette strings to hex when possible; else hash-based pastel */
export function parseColorSwatches(palette: string[]): ColorSwatch[] {
  return palette.slice(0, 12).map(raw => {
    const full = raw.replace(/\s+/g, ' ').trim();
    const hexMatch = full.match(HEX_INLINE);
    if (hexMatch) {
      let h = hexMatch[0];
      if (h.length === 4) {
        const r = h[1];
        const g = h[2];
        const b = h[3];
        h = `#${r}${r}${g}${g}${b}${b}`;
      }
      const label = full.replace(hexMatch[0], '').replace(/^[\s:–-]+/, '').trim() || 'Swatch';
      return { label, css: h };
    }
    const label = full;
    const lower = label.toLowerCase();
    let css = '';
    for (const [word, hex] of Object.entries(COLOR_WORDS)) {
      if (lower.includes(word)) {
        css = hex;
        break;
      }
    }
    if (!css) {
      const h = hashString(label) % 360;
      css = `hsl(${h} 38% 72%)`;
    }
    return { label, css };
  });
}

/** v2 moodboard: explicit name + hex from model output */
export function colorSwatchesFromNamedHex(
  palette: Array<{ name: string; hex: string }>,
): ColorSwatch[] {
  return palette.slice(0, 16).map(({ name, hex }) => {
    const t = hex.trim();
    const ok = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t);
    let css = t;
    if (ok && t.length === 4) {
      const r = t[1];
      const g = t[2];
      const b = t[3];
      css = `#${r}${r}${g}${g}${b}${b}`;
    } else if (!ok) {
      const h = hashString(name) % 360;
      css = `hsl(${h} 38% 72%)`;
    }
    return { label: name.replace(/\s+/g, ' ').trim(), css };
  });
}

export interface ContradictionPair {
  left: string;
  right: string;
}

const SPLIT_RE = /\s+(?:but|yet|however|though)\s+/i;
const ARROW_SPLIT = /\s*[↔—–-]{1,3}\s*|\s+vs\.?\s+/i;

/**
 * Split tension lines into "appear" vs "actually" when phrasing allows.
 */
export function splitContradiction(line: string): ContradictionPair | null {
  const t = line.replace(/\s+/g, ' ').trim();
  if (!t) return null;

  const commaBut = t.match(/^(.+?)\s*,\s*but\s+(.+)$/i);
  if (commaBut) return { left: commaBut[1].trim(), right: commaBut[2].trim() };

  const splitBut = t.split(SPLIT_RE).filter(Boolean);
  if (splitBut.length === 2 && splitBut[0] && splitBut[1]) {
    return { left: splitBut[0].trim(), right: splitBut[1].trim() };
  }

  const parts = t.split(ARROW_SPLIT).filter(Boolean);
  if (parts.length === 2) {
    return { left: parts[0].trim(), right: parts[1].trim() };
  }

  const youBut = t.match(/^You\s+(.+?)\s+but\s+(.+)$/i);
  if (youBut) return { left: `You ${youBut[1].trim()}`, right: youBut[2].trim() };

  return null;
}

/** First clause for card title / brand guess */
export function extractShoppingCardParts(line: string): { headline: string; detail: string } {
  const t = line.replace(/\s+/g, ' ').trim();
  const dash = t.split(/\s*[—–-]\s*/);
  if (dash.length >= 2) {
    return { headline: dash[0].trim(), detail: dash.slice(1).join(' — ').trim() };
  }
  const paren = t.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren) return { headline: paren[1].trim(), detail: paren[2].trim() };
  if (t.length <= 72) return { headline: t, detail: '' };
  return { headline: t.slice(0, 68).trim() + '…', detail: t };
}

/** Tokenize taste text into floating “genre” pills */
export function tastePillsFromText(music: string, max = 8): string[] {
  const parts = music
    .split(/[,;·•]|(?:\s+and\s+)|(?:\s+\/\s+)/i)
    .map(s => s.trim())
    .filter(s => s.length > 2 && s.length < 42);
  return [...new Set(parts)].slice(0, max);
}
