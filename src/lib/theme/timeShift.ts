/**
 * Time-based color modulation.
 *
 * Shifts the accent palette warmth/coolness based on time of day:
 *  - Morning (6am–12pm): warmer tones, slight brightness boost
 *  - Afternoon (12pm–6pm): neutral (no shift)
 *  - Night (6pm–6am): cooler, deeper tones, more contrast
 *
 * Works by adjusting the HSL values of the accent palette.
 */

import { browser } from '$app/environment';
import { buildPaletteFromHSL, applyPalette, type AccentPalette } from './identityColors';

interface HSL { h: number; s: number; l: number; }

function hexToHSL(hex: string): HSL {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

type TimePhase = 'morning' | 'afternoon' | 'night';

function getTimePhase(hour?: number): TimePhase {
  const h = hour ?? new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'night';
}

const SHIFT: Record<TimePhase, { hue: number; sat: number; light: number }> = {
  morning:   { hue: +8,  sat: +4,  light: +3  },
  afternoon: { hue: 0,   sat: 0,   light: 0   },
  night:     { hue: -12, sat: -3,  light: -5  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyTimeShift(basePalette: AccentPalette): AccentPalette {
  const phase = getTimePhase();
  const shift = SHIFT[phase];

  const base = hexToHSL(basePalette.primary);
  const shifted: HSL = {
    h: (base.h + shift.hue + 360) % 360,
    s: clamp(base.s + shift.sat, 25, 90),
    l: clamp(base.l + shift.light, 30, 80),
  };

  const palette = buildPaletteFromHSL(shifted);
  applyPalette(palette);
  return palette;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTimeShiftLoop(basePalette: AccentPalette): () => void {
  if (!browser) return () => {};

  applyTimeShift(basePalette);

  const msToNextHour = (60 - new Date().getMinutes()) * 60_000;
  const timeout = setTimeout(() => {
    applyTimeShift(basePalette);
    intervalId = setInterval(() => applyTimeShift(basePalette), 60 * 60_000);
  }, msToNextHour);

  return () => {
    clearTimeout(timeout);
    if (intervalId) clearInterval(intervalId);
  };
}
