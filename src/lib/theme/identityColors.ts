/**
 * Identity Color Engine
 *
 * Generates a per-user accent palette from connected social signals.
 * The palette is applied as CSS custom properties on <html> so every
 * component inherits identity-driven colors without prop-drilling.
 *
 * Brand default (no signals) stays BRBY-aligned blue; derived palettes
 * hue-shift from profile data so the app remains cohesive with global tokens.
 */

import { browser } from '$app/environment';

export interface AccentPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  glow: string;
  soft: string;
}

interface ProfileSignals {
  interests?: string[];
  instagramIdentity?: {
    aesthetic?: string;
    lifestyle?: string;
    brandVibes?: string[];
    musicVibe?: string;
    foodVibe?: string;
    interests?: string[];
    visual?: {
      colorPalette?: string[];
      aesthetic?: { tone?: string; brightness?: string };
    };
  } | null;
  spotifyIdentity?: {
    topGenres?: string[];
    musicPersonality?: string;
    vibeDescription?: string;
  } | null;
  appleMusicIdentity?: {
    topGenres?: string[];
    musicPersonality?: string;
  } | null;
}

interface HSL { h: number; s: number; l: number; }

const PALETTE_PRESETS: Record<string, HSL> = {
  minimal:    { h: 230, s: 65, l: 72 },  // soft blue-violet
  design:     { h: 230, s: 65, l: 72 },
  creative:   { h: 270, s: 60, l: 68 },  // purple
  artistic:   { h: 270, s: 60, l: 68 },
  food:       { h: 14,  s: 85, l: 65 },  // warm coral
  foodie:     { h: 14,  s: 85, l: 65 },
  culinary:   { h: 14,  s: 85, l: 65 },
  nightlife:  { h: 340, s: 80, l: 62 },  // hot pink
  party:      { h: 340, s: 80, l: 62 },
  clubbing:   { h: 340, s: 80, l: 62 },
  music:      { h: 260, s: 70, l: 65 },  // indigo-purple
  hiphop:     { h: 350, s: 75, l: 60 },  // rose-red
  electronic: { h: 280, s: 65, l: 65 },  // violet
  indie:      { h: 200, s: 55, l: 68 },  // muted blue
  jazz:       { h: 30,  s: 70, l: 60 },  // warm gold
  classical:  { h: 210, s: 40, l: 70 },  // steel blue
  pop:        { h: 320, s: 70, l: 65 },  // magenta
  rock:       { h: 0,   s: 65, l: 55 },  // deep red
  rnb:        { h: 280, s: 55, l: 60 },  // soft purple
  fitness:    { h: 160, s: 70, l: 55 },  // teal-green
  gym:        { h: 160, s: 70, l: 55 },
  travel:     { h: 185, s: 60, l: 60 },  // ocean blue
  adventure:  { h: 185, s: 60, l: 60 },
  fashion:    { h: 310, s: 60, l: 65 },  // soft pink
  luxury:     { h: 40,  s: 70, l: 62 },  // gold
  premium:    { h: 40,  s: 70, l: 62 },
  tech:       { h: 220, s: 75, l: 65 },  // bright blue
  gaming:     { h: 150, s: 80, l: 55 },  // neon green
  nature:     { h: 140, s: 50, l: 58 },  // forest green
  wellness:   { h: 170, s: 45, l: 62 },  // calm teal
  meditation: { h: 170, s: 45, l: 62 },
  coffee:     { h: 25,  s: 60, l: 48 },  // warm brown
  culture:    { h: 250, s: 55, l: 68 },  // soft violet
  cinema:     { h: 0,   s: 55, l: 55 },  // warm red
  sports:     { h: 210, s: 80, l: 58 },  // athletic blue
};

/** Default accent when profile has no signals — BRBY-aligned blue (identity tints stay in hue space from here). */
const DEFAULT_HSL: HSL = { h: 218, s: 72, l: 58 };

const VISUAL_COLOR_MAP: Record<string, HSL> = {
  'warm beige':     { h: 35,  s: 40, l: 68 },
  'beige':          { h: 35,  s: 40, l: 68 },
  'forest green':   { h: 140, s: 50, l: 45 },
  'green':          { h: 140, s: 50, l: 55 },
  'sunset orange':  { h: 20,  s: 80, l: 60 },
  'orange':         { h: 25,  s: 75, l: 60 },
  'ocean blue':     { h: 200, s: 65, l: 55 },
  'blue':           { h: 220, s: 65, l: 60 },
  'sky blue':       { h: 200, s: 60, l: 65 },
  'warm brown':     { h: 25,  s: 55, l: 45 },
  'brown':          { h: 25,  s: 55, l: 45 },
  'golden':         { h: 42,  s: 70, l: 58 },
  'gold':           { h: 42,  s: 70, l: 58 },
  'pink':           { h: 330, s: 65, l: 65 },
  'soft pink':      { h: 340, s: 55, l: 70 },
  'red':            { h: 0,   s: 70, l: 55 },
  'coral':          { h: 14,  s: 80, l: 62 },
  'purple':         { h: 270, s: 60, l: 60 },
  'lavender':       { h: 260, s: 45, l: 70 },
  'teal':           { h: 175, s: 55, l: 50 },
  'white':          { h: 0,   s: 0,  l: 90 },
  'black':          { h: 0,   s: 0,  l: 20 },
  'grey':           { h: 0,   s: 5,  l: 55 },
  'gray':           { h: 0,   s: 5,  l: 55 },
  'earthy':         { h: 30,  s: 45, l: 50 },
  'pastel':         { h: 280, s: 35, l: 75 },
  'neon':           { h: 150, s: 90, l: 55 },
  'muted':          { h: 200, s: 25, l: 60 },
  'warm':           { h: 30,  s: 55, l: 60 },
  'cool':           { h: 210, s: 50, l: 60 },
  'neutral':        { h: 40,  s: 15, l: 65 },
};

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hslToRgba(h: number, s: number, l: number, a: number): string {
  s /= 100;
  l /= 100;
  const sat = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - sat * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return `rgba(${Math.round(f(0) * 255)},${Math.round(f(8) * 255)},${Math.round(f(4) * 255)},${a})`;
}

function scoreKeyword(keyword: string): HSL | null {
  const lower = keyword.toLowerCase().trim();
  for (const [key, hsl] of Object.entries(PALETTE_PRESETS)) {
    if (lower.includes(key) || key.includes(lower)) return hsl;
  }
  return null;
}

function scoreVisualColor(colorDesc: string): HSL | null {
  const lower = colorDesc.toLowerCase().trim();
  for (const [key, hsl] of Object.entries(VISUAL_COLOR_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return hsl;
  }
  return null;
}

function averageHSL(hues: HSL[]): HSL {
  if (hues.length === 0) return DEFAULT_HSL;

  const sinSum = hues.reduce((s, c) => s + Math.sin((c.h * Math.PI) / 180), 0);
  const cosSum = hues.reduce((s, c) => s + Math.cos((c.h * Math.PI) / 180), 0);
  let avgH = (Math.atan2(sinSum / hues.length, cosSum / hues.length) * 180) / Math.PI;
  if (avgH < 0) avgH += 360;

  const avgS = hues.reduce((s, c) => s + c.s, 0) / hues.length;
  const avgL = hues.reduce((s, c) => s + c.l, 0) / hues.length;

  return { h: Math.round(avgH), s: Math.round(avgS), l: Math.round(avgL) };
}

export function extractPaletteFromProfile(profile: ProfileSignals): AccentPalette {
  const matches: HSL[] = [];

  const ig = profile.instagramIdentity;
  if (ig) {
    // Visual color palette is the highest-fidelity signal (triple-weighted)
    if (ig.visual?.colorPalette?.length) {
      for (const color of ig.visual.colorPalette.slice(0, 4)) {
        const m = scoreVisualColor(color);
        if (m) { matches.push(m); matches.push(m); matches.push(m); }
      }
      // Visual tone also influences the palette
      if (ig.visual.aesthetic?.tone === 'warm') matches.push({ h: 30, s: 50, l: 60 });
      else if (ig.visual.aesthetic?.tone === 'cool') matches.push({ h: 210, s: 50, l: 60 });
    }

    if (ig.aesthetic) {
      const m = scoreKeyword(ig.aesthetic);
      if (m) { matches.push(m); matches.push(m); }
    }
    if (ig.lifestyle) {
      const m = scoreKeyword(ig.lifestyle);
      if (m) matches.push(m);
    }
    if (ig.musicVibe) {
      const m = scoreKeyword(ig.musicVibe);
      if (m) matches.push(m);
    }
    if (ig.foodVibe) {
      const m = scoreKeyword(ig.foodVibe);
      if (m) matches.push(m);
    }
    for (const vibe of ig.brandVibes ?? []) {
      const m = scoreKeyword(vibe);
      if (m) matches.push(m);
    }
    for (const interest of ig.interests ?? []) {
      const m = scoreKeyword(interest);
      if (m) matches.push(m);
    }
  }

  const sp = profile.spotifyIdentity ?? profile.appleMusicIdentity;
  if (sp) {
    for (const genre of (sp.topGenres ?? []).slice(0, 5)) {
      const m = scoreKeyword(genre);
      if (m) { matches.push(m); matches.push(m); }
    }
    if (sp.musicPersonality) {
      const m = scoreKeyword(sp.musicPersonality);
      if (m) matches.push(m);
    }
  }

  for (const interest of (profile.interests ?? []).slice(0, 6)) {
    const m = scoreKeyword(interest);
    if (m) matches.push(m);
  }

  const base = averageHSL(matches);

  return buildPaletteFromHSL(base);
}

export function buildPaletteFromHSL(base: HSL): AccentPalette {
  return {
    primary: hslToHex(base.h, base.s, base.l),
    secondary: hslToHex(base.h, Math.max(base.s - 12, 30), Math.max(base.l - 14, 35)),
    tertiary: hslToHex(base.h, Math.max(base.s - 20, 20), Math.max(base.l - 30, 20)),
    glow: hslToRgba(base.h, base.s, base.l, 0.35),
    soft: hslToRgba(base.h, base.s, base.l, 0.12),
  };
}

export function applyPalette(palette: AccentPalette): void {
  if (!browser) return;
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', palette.primary);
  root.style.setProperty('--accent-secondary', palette.secondary);
  root.style.setProperty('--accent-tertiary', palette.tertiary);
  root.style.setProperty('--accent-glow', palette.glow);
  root.style.setProperty('--accent-soft', palette.soft);
}

export function applyPaletteFromProfile(profile: ProfileSignals): AccentPalette {
  const palette = extractPaletteFromProfile(profile);
  applyPalette(palette);
  return palette;
}
