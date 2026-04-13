/**
 * Runtime parse for identity_graph.identityIntelligence (server).
 * Types live in `$lib/types/identityIntelligence`.
 */

import {
  IDENTITY_INTELLIGENCE_SCHEMA_VERSION,
  type IdentityIntelligenceBlindspot,
  type IdentityIntelligenceDecision,
  type IdentityIntelligenceLeverage,
  type IdentityIntelligenceMode,
  type IdentityIntelligenceNow,
  type IdentityIntelligencePayload,
  type IdentityIntelligencePersonalization,
  type IdentityIntelligenceSnapshot,
  type IdentityIntelligenceTrajectory,
  type IdentityIntelligenceWrapper,
} from '$lib/types/identityIntelligence';

export type {
  IdentityIntelligencePayload,
  IdentityIntelligenceWrapper,
} from '$lib/types/identityIntelligence';

export { IDENTITY_INTELLIGENCE_SCHEMA_VERSION } from '$lib/types/identityIntelligence';

const MODE_SET = new Set<string>([
  'building',
  'executing',
  'exploring',
  'consuming',
  'stuck',
  'transitioning',
]);

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function num01(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

function str(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function strArr(x: unknown): string[] {
  if (Array.isArray(x)) return x.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean);
  return [];
}

function parseSnapshot(raw: unknown): IdentityIntelligenceSnapshot | null {
  if (!isObj(raw)) return null;
  const modeRaw = str(raw.mode);
  const mode: IdentityIntelligenceMode = MODE_SET.has(modeRaw)
    ? (modeRaw as IdentityIntelligenceMode)
    : 'exploring';
  const one_line_state = str(raw.one_line_state);
  if (!one_line_state) return null;
  const conf = num01(raw.confidence);
  if (conf === null) return null;
  return { mode, one_line_state, confidence: conf };
}

function parseNow(raw: unknown): IdentityIntelligenceNow | null {
  if (!isObj(raw)) return null;
  const focus = str(raw.focus);
  const pressure = str(raw.pressure);
  const momentum = str(raw.momentum);
  if (!focus || !pressure || !momentum) return null;
  return { focus, pressure, momentum };
}

function parseDecision(raw: unknown): IdentityIntelligenceDecision | null {
  if (!isObj(raw)) return null;
  const do_this_now = str(raw.do_this_now);
  const why_this_matters = str(raw.why_this_matters);
  const then_do = strArr(raw.then_do).slice(0, 12);
  const stop_doing = strArr(raw.stop_doing).slice(0, 12);
  if (!do_this_now || !why_this_matters) return null;
  return { do_this_now, then_do, stop_doing, why_this_matters };
}

function parseBlindspots(raw: unknown): IdentityIntelligenceBlindspot[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IdentityIntelligenceBlindspot[] = [];
  for (const item of raw) {
    if (!isObj(item)) return null;
    const issue = str(item.issue);
    const impact = str(item.impact);
    const fix = str(item.fix);
    if (!issue || !impact || !fix) return null;
    out.push({ issue, impact, fix });
    if (out.length >= 8) break;
  }
  return out;
}

function parseLeverage(raw: unknown): IdentityIntelligenceLeverage | null {
  if (!isObj(raw)) return null;
  const unfair_advantages = strArr(raw.unfair_advantages).slice(0, 10);
  const underused_assets = strArr(raw.underused_assets).slice(0, 10);
  const quick_wins = strArr(raw.quick_wins).slice(0, 10);
  return { unfair_advantages, underused_assets, quick_wins };
}

function parseTrajectory(raw: unknown): IdentityIntelligenceTrajectory | null {
  if (!isObj(raw)) return null;
  const direction = str(raw.direction);
  const risk = str(raw.risk);
  const next_critical_move = str(raw.next_critical_move);
  if (!direction || !risk || !next_critical_move) return null;
  return { direction, risk, next_critical_move };
}

function parsePersonalization(raw: unknown): IdentityIntelligencePersonalization | null {
  if (!isObj(raw)) return null;
  const tone = str(raw.tone);
  const style = str(raw.style);
  const response_format = str(raw.response_format);
  if (!tone || !style || !response_format) return null;
  return { tone, style, response_format };
}

export function parseIdentityIntelligencePayload(raw: unknown): IdentityIntelligencePayload | null {
  if (!isObj(raw)) return null;

  const snapshot = parseSnapshot(raw.snapshot);
  const now = parseNow(raw.now);
  const decision = parseDecision(raw.decision);
  const blindspots = parseBlindspots(raw.blindspots);
  const leverage = parseLeverage(raw.leverage);
  const trajectory = parseTrajectory(raw.trajectory);
  const personalization = parsePersonalization(raw.personalization);

  if (!snapshot || !now || !decision || !blindspots || !leverage || !trajectory || !personalization) {
    return null;
  }

  return {
    snapshot,
    now,
    decision,
    blindspots,
    leverage,
    trajectory,
    personalization,
  };
}

export function parseIdentityIntelligenceWrapper(raw: unknown): IdentityIntelligenceWrapper | null {
  if (!isObj(raw)) return null;
  const version = raw.version;
  if (version !== IDENTITY_INTELLIGENCE_SCHEMA_VERSION) return null;
  const generatedAt = str(raw.generatedAt);
  if (!generatedAt) return null;
  const userQueryRaw = raw.userQuery;
  const userQuery =
    typeof userQueryRaw === 'string' && userQueryRaw.trim() ? userQueryRaw.trim() : undefined;
  const payload = parseIdentityIntelligencePayload(raw.payload);
  if (!payload) return null;
  return { version: IDENTITY_INTELLIGENCE_SCHEMA_VERSION, generatedAt, userQuery, payload };
}
