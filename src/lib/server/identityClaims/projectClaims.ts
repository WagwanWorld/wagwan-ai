import type { IdentityGraph } from '$lib/server/identity';
import type { InferenceEvidenceSource } from '$lib/types/inferenceIdentity';
import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
import { claimFingerprint } from './fingerprint';
import type { IdentityClaimInsert, IdentityClaimKind } from './types';

function push(
  out: IdentityClaimInsert[],
  base: Omit<IdentityClaimInsert, 'content_fingerprint' | 'embedding'>,
): void {
  const assertion = base.assertion.replace(/\s+/g, ' ').trim();
  if (!assertion) return;
  out.push({
    ...base,
    assertion,
    content_fingerprint: claimFingerprint({
      domain: base.domain,
      source: base.source,
      claim_kind: base.claim_kind,
      assertion,
    }),
    embedding: null,
  });
}

function musicSource(g: IdentityGraph): InferenceEvidenceSource {
  if (g.signalMeta.hasStreamingIdentity && (g.topArtists.length || g.topGenres.length)) {
    return 'spotify';
  }
  if (g.topArtists.length || g.topGenres.length || g.appleMusicDescriptorTags?.length) {
    return 'apple_music';
  }
  return 'inferred_cross';
}

function graphClaims(
  googleSub: string,
  g: IdentityGraph,
  inferenceRevision: number | null,
): IdentityClaimInsert[] {
  const out: IdentityClaimInsert[] = [];
  const ms = musicSource(g);

  if (g.topArtists.length) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Listens closely to: ${g.topArtists.slice(0, 8).join(', ')}.`,
      domain: 'music',
      source: ms,
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'topArtists' },
    });
  }
  if (g.topGenres.length) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Music genres in rotation include ${g.topGenres.slice(0, 6).join(', ')}.`,
      domain: 'music',
      source: ms,
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'topGenres' },
    });
  }
  if (g.musicVibe?.trim() || g.musicPersonality?.trim()) {
    const parts = [g.musicVibe?.trim(), g.musicPersonality?.trim()].filter(Boolean);
    push(out, {
      user_google_sub: googleSub,
      assertion: `Music vibe: ${parts.join(' — ')}`,
      domain: 'music',
      source: ms,
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'musicVibe' },
    });
  }

  if (g.city?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Based in or tied to ${g.city.trim()}.`,
      domain: 'travel_food',
      source: 'manual',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'city' },
    });
  }

  if (g.aesthetic?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Visual / style aesthetic skews ${g.aesthetic.trim()}.`,
      domain: 'shopping_style',
      source: g.signalMeta.hasInstagram ? 'instagram' : 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'aesthetic' },
    });
  }
  if (g.foodVibe?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Food and dining taste: ${g.foodVibe.trim()}.`,
      domain: 'travel_food',
      source: g.signalMeta.hasInstagram ? 'instagram' : 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'foodVibe' },
    });
  }
  if (g.travelStyle?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Travel style: ${g.travelStyle.trim()}.`,
      domain: 'travel_food',
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'travelStyle' },
    });
  }

  if (g.role?.trim() || g.company?.trim()) {
    const bit = [g.role?.trim(), g.company?.trim()].filter(Boolean).join(' at ');
    push(out, {
      user_google_sub: googleSub,
      assertion: `Professional anchor: ${bit}${g.industry?.trim() ? ` (${g.industry.trim()})` : ''}.`,
      domain: 'career_work',
      source: g.signalMeta.hasLinkedIn ? 'linkedin' : 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'role' },
    });
  }
  if (g.headline?.trim() && g.headline !== g.role) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `LinkedIn-style headline: ${g.headline.trim()}.`,
      domain: 'career_work',
      source: g.signalMeta.hasLinkedIn ? 'linkedin' : 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'headline' },
    });
  }
  if (g.skills?.length) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Skills cluster around: ${g.skills.slice(0, 10).join(', ')}.`,
      domain: 'career_work',
      source: g.signalMeta.hasLinkedIn ? 'linkedin' : 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'skills' },
    });
  }

  if (g.activities.length) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Activities and hobbies include: ${g.activities.slice(0, 8).join(', ')}.`,
      domain: 'sports_fitness',
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'activities' },
    });
  }

  if (g.contentCategories?.length && g.signalMeta.hasYoutube) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `YouTube consumption themes: ${g.contentCategories.slice(0, 6).join(', ')}.`,
      domain: 'tech_media',
      source: 'youtube',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'contentCategories' },
    });
  }

  if (g.lifestyle?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Lifestyle pattern: ${g.lifestyle.trim()}.`,
      domain: 'wellness',
      source: g.signalMeta.hasInstagram ? 'instagram' : 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'lifestyle' },
    });
  }

  if (g.manualTags?.length) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Self-selected interests: ${g.manualTags.slice(0, 10).join(', ')}.`,
      domain: 'tech_media',
      source: 'manual',
      confidence: null,
      salience_0_100: null,
      inference_revision: inferenceRevision,
      claim_kind: 'graph_fact',
      payload: { field: 'manualTags' },
    });
  }

  return out;
}

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

function inferenceClaims(
  googleSub: string,
  wrap: InferenceIdentityWrapper,
): IdentityClaimInsert[] {
  const out: IdentityClaimInsert[] = [];
  const rev = wrap.revision;
  const c = wrap.current;

  if (c.intent?.primary?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Primary inferred intent right now: ${c.intent.primary.trim()}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: c.intent.confidence ?? null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'intent',
      payload: { secondary: c.intent.secondary ?? [] },
    });
  }

  for (const t of cap(c.interests?.explicit ?? [], 8)) {
    const s = String(t).trim();
    if (!s) continue;
    push(out, {
      user_google_sub: googleSub,
      assertion: `Explicit interest: ${s}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'interest',
      payload: { tier: 'explicit' },
    });
  }
  for (const t of cap(c.interests?.latent ?? [], 8)) {
    const s = String(t).trim();
    if (!s) continue;
    push(out, {
      user_google_sub: googleSub,
      assertion: `Latent interest signal: ${s}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'interest',
      payload: { tier: 'latent' },
    });
  }

  for (const t of cap(c.needs?.immediate ?? [], 5)) {
    const s = String(t).trim();
    if (!s) continue;
    push(out, {
      user_google_sub: googleSub,
      assertion: `Immediate need / tension: ${s}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'need',
      payload: { tier: 'immediate' },
    });
  }
  for (const t of cap(c.needs?.emerging ?? [], 5)) {
    const s = String(t).trim();
    if (!s) continue;
    push(out, {
      user_google_sub: googleSub,
      assertion: `Emerging need: ${s}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'need',
      payload: { tier: 'emerging' },
    });
  }

  if (c.trajectory?.direction?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: `Trajectory: ${c.trajectory.direction.trim()} (${c.trajectory.velocity ?? 'steady'}).`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'trajectory',
      payload: { stage_shift: c.trajectory.stage_shift_signals ?? [] },
    });
  }

  for (const a of cap(c.predictions?.likely_next_actions ?? [], 8)) {
    const s = String(a).trim();
    if (!s) continue;
    push(out, {
      user_google_sub: googleSub,
      assertion: `Likely next action: ${s}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'prediction',
      payload: {},
    });
  }

  for (const d of c.life_domains ?? []) {
    const domId = d.id as string;
    if (d.narrative?.trim()) {
      push(out, {
        user_google_sub: googleSub,
        assertion: d.narrative.trim(),
        domain: domId,
        source: 'inferred_cross',
        confidence: d.confidence ?? null,
        salience_0_100: d.salience_0_100 ?? null,
        inference_revision: rev,
        claim_kind: 'narrative',
        payload: { domain_label: d.label },
      });
    }
    for (const ev of cap(d.evidence ?? [], 10)) {
      const txt = ev.text?.trim();
      if (!txt) continue;
      push(out, {
        user_google_sub: googleSub,
        assertion: txt,
        domain: domId,
        source: ev.source as InferenceEvidenceSource,
        confidence: d.confidence ?? null,
        salience_0_100: d.salience_0_100 ?? null,
        inference_revision: rev,
        claim_kind: 'evidence',
        payload: {},
      });
    }
    for (const sig of cap(d.signals ?? [], 8)) {
      const txt = String(sig).trim();
      if (!txt) continue;
      push(out, {
        user_google_sub: googleSub,
        assertion: `Signal (${d.label}): ${txt}.`,
        domain: domId,
        source: 'inferred_cross',
        confidence: d.confidence ?? null,
        salience_0_100: d.salience_0_100 ?? null,
        inference_revision: rev,
        claim_kind: 'signal',
        payload: {},
      });
    }
    for (const ln of cap(d.likely_next ?? [], 5)) {
      const txt = String(ln).trim();
      if (!txt) continue;
      push(out, {
        user_google_sub: googleSub,
        assertion: `Likely next in ${d.label}: ${txt}.`,
        domain: domId,
        source: 'inferred_cross',
        confidence: d.confidence ?? null,
        salience_0_100: d.salience_0_100 ?? null,
        inference_revision: rev,
        claim_kind: 'prediction',
        payload: {},
      });
    }
  }

  const pr = c.predictive_read;
  if (pr?.you_in_one_line?.trim()) {
    push(out, {
      user_google_sub: googleSub,
      assertion: pr.you_in_one_line.trim(),
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'narrative',
      payload: { kind: 'predictive_one_liner' },
    });
  }
  for (const m of cap(pr?.next_moves ?? [], 6)) {
    const s = String(m).trim();
    if (!s) continue;
    push(out, {
      user_google_sub: googleSub,
      assertion: `Predicted next move: ${s}.`,
      domain: null,
      source: 'inferred_cross',
      confidence: null,
      salience_0_100: null,
      inference_revision: rev,
      claim_kind: 'prediction',
      payload: {},
    });
  }

  return out;
}

/**
 * Build insert rows for `user_identity_claims` from the resolved identity graph + inference wrapper.
 */
export function projectIdentityClaims(
  googleSub: string,
  graph: IdentityGraph,
  inference: InferenceIdentityWrapper | null,
): IdentityClaimInsert[] {
  const rev = inference?.revision ?? null;
  const merged = [...graphClaims(googleSub, graph, rev)];
  if (inference) {
    merged.push(...inferenceClaims(googleSub, inference));
  }
  return merged;
}
