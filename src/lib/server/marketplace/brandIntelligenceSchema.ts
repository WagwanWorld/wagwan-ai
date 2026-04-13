/**
 * Runtime parse for brand intelligence JSON (server).
 */

import type { BrandAudienceIntel, BrandMemberBrief } from '$lib/types/brandIntelligence';

export type { BrandAudienceIntel, BrandMemberBrief } from '$lib/types/brandIntelligence';

const MAX_LINE = 900;

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function line(x: unknown): string {
  if (typeof x !== 'string') return '';
  const t = x.replace(/\s+/g, ' ').trim();
  if (t.length > MAX_LINE) return `${t.slice(0, MAX_LINE - 1)}…`;
  return t;
}

export function parseBrandMemberBrief(raw: unknown): BrandMemberBrief | null {
  if (!isObj(raw)) return null;
  const happening_now = line(raw.happening_now);
  const do_next = line(raw.do_next);
  const missing = line(raw.missing ?? raw.blind_spot ?? raw.whats_missing);
  if (!happening_now || !do_next || !missing) return null;
  return { happening_now, do_next, missing };
}

export function parseBrandAudienceIntel(raw: unknown): BrandAudienceIntel | null {
  if (!isObj(raw)) return null;
  const trying_to_achieve = line(raw.trying_to_achieve);
  const struggling_with = line(raw.struggling_with);
  const content_that_converts = line(raw.content_that_converts);
  const will_pay_for = line(raw.will_pay_for);
  if (!trying_to_achieve || !struggling_with || !content_that_converts || !will_pay_for) return null;
  return { trying_to_achieve, struggling_with, content_that_converts, will_pay_for };
}
