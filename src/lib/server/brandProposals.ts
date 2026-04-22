// src/lib/server/brandProposals.ts
//
// Action engine: generates content ideas, creator matches,
// and strategy proposals from brand intelligence.

import Anthropic from '@anthropic-ai/sdk';
import type { BrandIntelligenceResult, AudiencePortrait, StrategicPositioning } from './brandIntelligence';
import type { TrajectoryResult, MetricDelta } from './brandTrajectory';
import { getServiceSupabase } from './supabase';
import { computeGraphStrength } from './marketplace/graphStrength';
import { flattenIdentityGraph } from './marketplace/identityGraphTags';

export interface ContentProposal {
  type: 'content';
  title: string;
  format: string;
  hook: string;
  captionDraft: string;
  hashtags: string[];
  optimalTime: string;
  contentPillar: string;
  reasoning: string;
}

export interface CreatorMatchProposal {
  type: 'creator_match';
  // Wagwan user
  creatorGoogleSub?: string;
  // External creator
  igUsername?: string;
  name: string;
  followers: number;
  matchScore?: number;
  matchReasoning: string;
  suggestedMessage: string;
  profileUrl: string;
  source: 'wagwan' | 'external';
}

export interface StrategyProposal {
  type: 'strategy';
  title: string;
  description: string;
  reasoning: string;
  dataBacking: string;
  urgency: 'high' | 'medium' | 'low';
}

export type Proposal = ContentProposal | CreatorMatchProposal | StrategyProposal;

export async function generateContentProposals(
  intelligence: BrandIntelligenceResult,
  apiKey: string,
): Promise<ContentProposal[]> {
  try {
    const client = new Anthropic({ apiKey });
    const { profile, strategicPositioning, audiencePortrait, bestHours, topHashtags, contentPerformance, identity } = intelligence;
    const id = identity as any;

    // Build rich identity context
    const identityLines: string[] = [];
    if (id.aesthetic) identityLines.push(`Aesthetic: ${id.aesthetic}`);
    if (id.brandVibes?.length) identityLines.push(`Brand vibes: ${id.brandVibes.join(', ')}`);
    if (id.interests?.length) identityLines.push(`Interests: ${id.interests.join(', ')}`);
    if (id.captionIntent) identityLines.push(`Caption style: ${id.captionIntent}`);
    if (id.personality) identityLines.push(`Personality: expressive=${id.personality.expressive}, humor=${id.personality.humor}`);
    if (id.rawSummary) identityLines.push(`Brand summary: ${id.rawSummary.slice(0, 300)}`);

    const bestFormat = Object.entries(contentPerformance.formatBreakdown || {}).sort((a, b) => (b[1] as any).avgEngagement - (a[1] as any).avgEngagement)[0]?.[0] || 'IMAGE';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a content strategist. Generate 5 specific, creative content ideas for this brand. Each idea should be unique, actionable, and tailored to their brand identity. Return ONLY valid JSON array, no markdown wrapping.

=== BRAND ===
@${profile.username} — ${profile.name} (${profile.followers_count} followers)
Bio: ${profile.biography || 'none'}
${identityLines.join('\n')}

=== STRATEGY ===
Direction: ${strategicPositioning.brandDirection || 'Build authority in their niche'}
Pillars: ${strategicPositioning.contentPillars?.join(', ') || 'content, community, culture, growth'}
Voice: ${strategicPositioning.voiceGuidelines || 'Authentic, direct, community-focused'}

=== PERFORMANCE ===
Audience: ${audiencePortrait.narrative || 'Niche community interested in brand themes'}
Best format: ${bestFormat}
${contentPerformance.reachDrivers ? `Reach drivers: ${contentPerformance.reachDrivers}` : ''}
Top hashtags: ${topHashtags.slice(0, 6).map(h => h.tag).join(', ') || 'none'}
Best posting hour (UTC): ${bestHours[0]?.hour ?? 14}

Return array of exactly 5 ideas:
[{
  "title": "specific idea title",
  "format": "REEL|CAROUSEL|IMAGE",
  "hook": "opening hook line that grabs attention",
  "captionDraft": "Full caption draft (2-3 sentences + CTA)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "optimalTime": "day and time recommendation",
  "contentPillar": "which pillar this maps to",
  "reasoning": "Why this specific idea works for THIS brand's audience"
}]`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const ideas = JSON.parse(cleaned);
    return ideas.map((idea: any) => ({ ...idea, type: 'content' as const }));
  } catch {
    return [];
  }
}

export async function generateStrategyProposals(
  trajectory: TrajectoryResult,
  intelligence: BrandIntelligenceResult,
  apiKey: string,
): Promise<StrategyProposal[]> {
  // Only generate strategy proposals when there's meaningful trajectory data
  if (trajectory.deltas.length === 0) return [];

  try {
    const client = new Anthropic({ apiKey });
    const significantDeltas = trajectory.deltas.filter(d => Math.abs(d.deltaPct) > 5);
    const anomalies = trajectory.anomalies;

    if (significantDeltas.length === 0 && anomalies.length === 0) return [];

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Based on these brand metric changes, suggest strategic adjustments. Return ONLY valid JSON array.

Brand: @${intelligence.profile.username} (${intelligence.profile.followers_count} followers)

Metric changes:
${significantDeltas.map(d => `${d.metric}: ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}% (${d.previous} → ${d.current})`).join('\n')}

Anomalies:
${anomalies.map(a => `[${a.severity}] ${a.message}`).join('\n') || 'None'}

Audience drift: ${trajectory.audienceDrift}

Return 1-3 proposals:
[{
  "title": "Short action title",
  "description": "2-3 sentences explaining the proposed change",
  "reasoning": "Why this matters based on the data",
  "dataBacking": "The specific metrics that triggered this",
  "urgency": "high|medium|low"
}]`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned2 = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const proposals = JSON.parse(cleaned2);
    return proposals.map((p: any) => ({ ...p, type: 'strategy' as const }));
  } catch {
    return [];
  }
}

/** Auto-match Wagwan creators to the brand using identity graph signals */
export async function generateCreatorMatchProposals(
  intelligence: BrandIntelligenceResult,
  apiKey: string,
): Promise<CreatorMatchProposal[]> {
  try {
    const sb = getServiceSupabase();
    const { data: rows } = await sb
      .from('user_profiles')
      .select('google_sub, name, profile_data, identity_graph')
      .limit(200);

    if (!rows?.length) return [];

    const id = intelligence.identity as any;
    const brandInterests = (id.interests || []) as string[];
    const brandVibes = (id.brandVibes || []) as string[];
    const brandAesthetic = (id.aesthetic || '') as string;
    const brandCity = (id.city || '') as string;

    // Score each creator against the brand
    const scored: Array<{
      name: string;
      handle: string;
      followers: number;
      location: string;
      score: number;
      reasons: string[];
      tags: string[];
      googleSub: string;
    }> = [];

    for (const row of rows) {
      const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
      const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
      const creatorIg = profileData.instagramIdentity as Record<string, unknown> | undefined;
      const name = (row.name as string) || '';
      if (!name) continue;

      const strength = computeGraphStrength(graph, profileData);
      const tags = flattenIdentityGraph(graph);

      const creatorInterests = (graph.interests || []) as string[];
      const creatorVibes = (graph.brandVibes || []) as string[];
      const creatorAesthetic = (graph.aesthetic || '') as string;
      const creatorCity = (graph.city || profileData.city || '') as string;

      // Scoring
      let score = 0;
      const reasons: string[] = [];

      // Interest overlap
      const interestOverlap = brandInterests.filter(i =>
        creatorInterests.some(ci => ci.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(ci.toLowerCase()))
      );
      if (interestOverlap.length > 0) {
        score += interestOverlap.length * 15;
        reasons.push(`Shared interests: ${interestOverlap.slice(0, 3).join(', ')}`);
      }

      // Vibe alignment
      const vibeOverlap = brandVibes.filter(v =>
        creatorVibes.some(cv => cv.toLowerCase().includes(v.toLowerCase()))
      );
      if (vibeOverlap.length > 0) {
        score += vibeOverlap.length * 10;
        reasons.push(`Vibe match: ${vibeOverlap.slice(0, 2).join(', ')}`);
      }

      // Aesthetic match
      if (brandAesthetic && creatorAesthetic && brandAesthetic.toLowerCase() === creatorAesthetic.toLowerCase()) {
        score += 20;
        reasons.push(`Aesthetic alignment: ${brandAesthetic}`);
      }

      // Location match
      if (brandCity && creatorCity && creatorCity.toLowerCase().includes(brandCity.toLowerCase())) {
        score += 15;
        reasons.push(`Same city: ${creatorCity}`);
      }

      // Graph strength bonus
      if (strength.score > 60) {
        score += 10;
      }

      if (score > 0 && reasons.length > 0) {
        scored.push({
          name,
          handle: (creatorIg?.username as string) || '',
          followers: (creatorIg?.followersCount as number) || 0,
          location: creatorCity,
          score,
          reasons,
          tags: tags.slice(0, 5),
          googleSub: row.google_sub as string,
        });
      }
    }

    // Sort by score, take top 10
    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 10);

    if (topMatches.length === 0) return [];

    // Use Claude to generate personalized outreach messages for top 5
    const client = new Anthropic({ apiKey });
    const matchSummary = topMatches.slice(0, 5).map((m, i) =>
      `${i + 1}. ${m.name} (@${m.handle || 'no handle'}, ${m.followers} followers, ${m.location || 'unknown'}) — ${m.reasons.join('; ')}`
    ).join('\n');

    let outreachMessages: string[] = [];
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Write 5 short, personalized outreach DM messages from @${intelligence.profile.username} (${(intelligence.profile as any).name || ''}) to these matched creators. Each message should be 2-3 sentences, mention WHY they're a good fit, and feel personal — not templated. Return ONLY a JSON array of 5 strings, no markdown.

Brand: ${id.rawSummary?.slice(0, 200) || `@${intelligence.profile.username}`}

Creators:
${matchSummary}

Return: ["message for creator 1", "message for creator 2", ...]`
        }],
      });
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      outreachMessages = JSON.parse(cleaned);
    } catch {
      outreachMessages = topMatches.slice(0, 5).map(m =>
        `Hey ${m.name.split(' ')[0]}! We love your content and think there's a natural fit with what we're building at @${intelligence.profile.username}. Would love to explore a collaboration — interested?`
      );
    }

    return topMatches.slice(0, 5).map((m, i): CreatorMatchProposal => ({
      type: 'creator_match',
      creatorGoogleSub: m.googleSub,
      name: m.name,
      followers: m.followers,
      matchScore: Math.min(Math.round(m.score), 100),
      matchReasoning: m.reasons.join('. '),
      suggestedMessage: outreachMessages[i] || '',
      profileUrl: m.handle ? `https://instagram.com/${m.handle}` : '',
      source: 'wagwan',
    }));
  } catch (e) {
    console.error('[Proposals] Creator matching failed:', e);
    return [];
  }
}
