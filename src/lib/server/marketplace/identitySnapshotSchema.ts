/**
 * Runtime parse + validation for identity_graph.identitySnapshot (server).
 * Types live in `$lib/types/identitySnapshot`.
 */

import {
  IDENTITY_SNAPSHOT_SCHEMA_VERSION,
  type IdentitySnapshotAestheticProfile,
  type IdentitySnapshotPayload,
  type IdentitySnapshotShoppingStyle,
  type IdentitySnapshotSocialIdentity,
  type IdentitySnapshotStatus,
  type IdentitySnapshotTaste,
  type IdentitySnapshotWrapper,
} from '$lib/types/identitySnapshot';

export type { IdentitySnapshotPayload, IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
export { IDENTITY_SNAPSHOT_SCHEMA_VERSION } from '$lib/types/identitySnapshot';

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function str(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

/** Tags array: filter empties, cap at maxLen, each tag ≤ maxWords words. */
function tagArr(x: unknown, maxLen = 12, maxWords = 5): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.trim())
    .filter(t => t.length > 0 && t.split(/\s+/).length <= maxWords)
    .slice(0, maxLen);
}

/** Short string array (no word cap, just length cap). */
function strArr(x: unknown, maxLen = 12): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, maxLen);
}

function parseAestheticProfile(raw: unknown): IdentitySnapshotAestheticProfile | null {
  if (!isObj(raw)) return null;
  return {
    visual: tagArr(raw.visual),
    brands: tagArr(raw.brands),
    spaces: tagArr(raw.spaces),
  };
}

function parseShoppingStyle(raw: unknown): IdentitySnapshotShoppingStyle | null {
  if (!isObj(raw)) return null;
  const type = str(raw.type);
  if (!type) return null;
  return { type, signals: strArr(raw.signals) };
}

function parseTaste(raw: unknown): IdentitySnapshotTaste | null {
  if (!isObj(raw)) return null;
  return {
    music: tagArr(raw.music),
    media: tagArr(raw.media),
    cultural: tagArr(raw.cultural),
  };
}

function parseSocialIdentity(raw: unknown): IdentitySnapshotSocialIdentity | null {
  if (!isObj(raw)) return null;
  const how = str(raw.how_people_see_you);
  const actual = str(raw.actual_you);
  if (!how || !actual) return null;
  return { how_people_see_you: how, actual_you: actual };
}

function parseStatus(raw: unknown): IdentitySnapshotStatus | null {
  if (!isObj(raw)) return null;
  const level = str(raw.level);
  const direction = str(raw.direction);
  if (!level || !direction) return null;
  return { level, direction };
}

export function parseIdentitySnapshotPayload(raw: unknown): IdentitySnapshotPayload | null {
  if (!isObj(raw)) return null;

  const one_liner = str(raw.one_liner);
  const archetype = str(raw.archetype);
  const current_mode = str(raw.current_mode);
  const core_contradiction = str(raw.core_contradiction);

  if (!one_liner || !archetype || !current_mode || !core_contradiction) return null;

  const vibe = tagArr(raw.vibe);
  const identity_tags = tagArr(raw.identity_tags);
  const aesthetic_profile = parseAestheticProfile(raw.aesthetic_profile);
  const shopping_style = parseShoppingStyle(raw.shopping_style);
  const taste = parseTaste(raw.taste);
  const social_identity = parseSocialIdentity(raw.social_identity);
  const status = parseStatus(raw.status);

  if (!aesthetic_profile || !shopping_style || !taste || !social_identity || !status) return null;

  return {
    one_liner,
    archetype,
    vibe,
    identity_tags,
    current_mode,
    core_contradiction,
    aesthetic_profile,
    shopping_style,
    taste,
    social_identity,
    status,
  };
}

export function parseIdentitySnapshotWrapper(raw: unknown): IdentitySnapshotWrapper | null {
  if (!isObj(raw)) return null;
  if (raw.version !== IDENTITY_SNAPSHOT_SCHEMA_VERSION) return null;
  const generatedAt = str(raw.generatedAt);
  if (!generatedAt) return null;
  const payload = parseIdentitySnapshotPayload(raw.payload);
  if (!payload) return null;
  return { version: IDENTITY_SNAPSHOT_SCHEMA_VERSION, generatedAt, payload };
}
