import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { IdentityAtom, UnifiedSignal, VibeCluster } from '$lib/types/expressionLayer';
import { randomId } from './seed';

const MODEL = 'claude-haiku-4-5-20251001';

function stripFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function extractJsonObject(text: string): unknown {
  const s = stripFence(text);
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function wordCount(label: string): number {
  return label.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeAtom(a: unknown): IdentityAtom | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  const label = String(o.label ?? '').trim();
  const category = String(o.category ?? 'general').trim() || 'general';
  const strength = typeof o.strength === 'number' && Number.isFinite(o.strength) ? o.strength : 0.65;
  if (!label || wordCount(label) > 5 || wordCount(label) < 1) return null;
  return { label, strength: Math.max(0, Math.min(1, strength)), category };
}

function normalizeVibe(v: unknown, atomLabels: Set<string>): VibeCluster | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const name = String(o.name ?? '').trim();
  if (!name || name.length > 48) return null;
  const strength =
    typeof o.strength === 'number' && Number.isFinite(o.strength) ? o.strength : 0.75;
  const rawAtoms = Array.isArray(o.atoms) ? o.atoms : [];
  const atoms: string[] = [];
  for (const x of rawAtoms) {
    const lab = String(x).trim();
    if (atomLabels.has(lab)) atoms.push(lab);
  }
  if (atoms.length < 1) return null;
  return {
    id: randomId('vibe'),
    name,
    atoms,
    strength: Math.max(0, Math.min(1, strength)),
  };
}

export interface AtomsVibesLlmResult {
  atoms: IdentityAtom[];
  vibes: VibeCluster[];
}

export async function runAtomsAndVibesLlm(
  topSignals: UnifiedSignal[],
  identitySummary: string,
): Promise<AtomsVibesLlmResult | null> {
  const key = (env.ANTHROPIC_API_KEY ?? '').trim();
  if (!key) return null;

  const signalBlock = topSignals
    .slice(0, 45)
    .map(
      s =>
        `- [${s.type}/${s.source}] ${s.value} (score ${s.strength_score.toFixed(2)})`,
    )
    .join('\n');

  const prompt = `You are an identity expression engine. From SIGNALS, emit:
1) identity ATOMS: short phrases only — max 4 words each, concrete and visualizable (things you can picture). No generic words alone like "music" or "travel". 15–32 atoms.
2) VIBES: 3–5 named clusters. Each vibe has a human title (2–4 words, Title Case) and lists which atom labels belong to it. Atoms can only appear in one vibe. Prioritize strongest, cross-domain mixes where real.

Identity summary:
${identitySummary.slice(0, 900)}

SIGNALS:
${signalBlock}

Return JSON only:
{
  "atoms": [{"label":"clean silhouettes","strength":0.81,"category":"fashion"}, ...],
  "vibes": [{"name":"Editorial Minimal","atoms":["clean silhouettes","neutral tones"],"strength":0.84}, ...]
}`;

  try {
    const anthropic = new Anthropic({ apiKey: key, timeout: 90_000 });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const parsed = extractJsonObject(text) as Record<string, unknown> | null;
    if (!parsed) return null;

    const rawAtoms = Array.isArray(parsed.atoms) ? parsed.atoms : [];
    const atoms: IdentityAtom[] = [];
    for (const x of rawAtoms) {
      const na = normalizeAtom(x);
      if (na) atoms.push(na);
    }

    const labelSet = new Set(atoms.map(a => a.label));
    const rawVibes = Array.isArray(parsed.vibes) ? parsed.vibes : [];
    const vibes: VibeCluster[] = [];
    for (const x of rawVibes) {
      const nv = normalizeVibe(x, labelSet);
      if (nv) vibes.push(nv);
    }

    if (atoms.length < 4) return null;
    return { atoms: dedupeAtoms(atoms).slice(0, 40), vibes: vibes.slice(0, 5) };
  } catch (e) {
    console.error('[atomsVibesLlm]', e instanceof Error ? e.message : e);
    return null;
  }
}

function dedupeAtoms(atoms: IdentityAtom[]): IdentityAtom[] {
  const seen = new Set<string>();
  const out: IdentityAtom[] = [];
  for (const a of atoms) {
    const k = a.label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/** Deterministic fallback when LLM unavailable or failed. */
export function fallbackAtomsAndVibesFromSignals(topSignals: UnifiedSignal[]): AtomsVibesLlmResult {
  const atoms: IdentityAtom[] = topSignals.slice(0, 24).map((s, i) => ({
    label: shortenToAtom(s.value, i),
    strength: s.strength_score,
    category: s.type,
  }));

  const deduped = dedupeAtoms(atoms);
  const half = Math.ceil(deduped.length / 2);
  const a1 = deduped.slice(0, half);
  const a2 = deduped.slice(half);
  const vibes: VibeCluster[] = [];
  if (a1.length) {
    vibes.push({
      id: randomId('vibe'),
      name: 'Core Signal Mix',
      atoms: a1.map(a => a.label),
      strength: avgStrength(a1),
    });
  }
  if (a2.length) {
    vibes.push({
      id: randomId('vibe'),
      name: 'Secondary Texture',
      atoms: a2.map(a => a.label),
      strength: avgStrength(a2),
    });
  }
  return { atoms: deduped, vibes };
}

function avgStrength(rows: IdentityAtom[]): number {
  if (!rows.length) return 0.5;
  return rows.reduce((s, a) => s + a.strength, 0) / rows.length;
}

function shortenToAtom(value: string, salt: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, 80);
  const parts = cleaned.split(/[,;]+/)[0]?.trim() ?? cleaned;
  const words = parts.split(/\s+/).filter(Boolean).slice(0, 4);
  if (words.length === 0) return `signal ${salt + 1}`;
  return words.join(' ');
}
