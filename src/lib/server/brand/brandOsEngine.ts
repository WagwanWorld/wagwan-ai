import { getServiceSupabase } from '$lib/server/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import {
  DAILY_BRIEF_SYSTEM,
  buildDailyBriefUserPrompt,
  BRAND_OS_PROMPT_VERSIONS,
} from '$lib/server/prompts/brand-os';

type FingerprintInput = {
  brandIgId: string;
  postId: string;
  mediaType: string;
  caption: string;
  postedAt: string;
  likes: number;
  comments: number;
  saves?: number;
  shares?: number;
  reach?: number;
  followers?: number;
};

const HOOK_PATTERNS: Array<{ archetype: string; re: RegExp }> = [
  { archetype: 'question', re: /\?/ },
  { archetype: 'how_to', re: /\bhow to\b/i },
  { archetype: 'listicle', re: /\b\d+\s*(tips|ways|ideas|lessons)\b/i },
  { archetype: 'authority', re: /\bwe found\b|\bour team\b|\bcase study\b/i },
];

const CTA_PATTERNS: Array<{ cta: string; re: RegExp }> = [
  { cta: 'comment', re: /\bcomment\b|\btell us\b/i },
  { cta: 'share', re: /\bshare\b|\bsend this\b/i },
  { cta: 'save', re: /\bsave\b|\bbookmark\b/i },
  { cta: 'link', re: /\blink in bio\b|\bclick\b/i },
];

function estimateReadingGrade(text: string): number {
  const words = (text.match(/\b[a-zA-Z]{1,}\b/g) || []).length;
  const sentences = Math.max(1, (text.match(/[.!?]/g) || []).length);
  const syllables = (text.match(/[aeiouy]{1,2}/gi) || []).length;
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / Math.max(words, 1));
  const mapped = 20 - Math.max(0, Math.min(20, score / 10));
  return Number(mapped.toFixed(2));
}

function extractHookArchetype(text: string): string {
  const first = text.split('\n')[0] || text;
  for (const rule of HOOK_PATTERNS) {
    if (rule.re.test(first)) return rule.archetype;
  }
  return 'generic';
}

function extractCta(text: string): string {
  for (const rule of CTA_PATTERNS) {
    if (rule.re.test(text)) return rule.cta;
  }
  return 'none';
}

function hashtagPlacement(text: string): string {
  const tags = text.match(/#[\w]+/g) || [];
  if (!tags.length) return 'none';
  const firstTag = text.indexOf(tags[0] ?? '');
  const pct = firstTag / Math.max(1, text.length);
  if (pct < 0.33) return 'front';
  if (pct > 0.66) return 'tail';
  return 'mixed';
}

export function buildFingerprint(input: FingerprintInput) {
  const caption = input.caption || '';
  const emojis = (caption.match(/\p{Emoji}/gu) || []).length;
  const words = (caption.match(/\b[a-zA-Z]{1,}\b/g) || []).length;
  const likes = Number(input.likes || 0);
  const comments = Number(input.comments || 0);
  const saves = Number(input.saves || 0);
  const shares = Number(input.shares || 0);
  const reach = Number(input.reach || 0);
  const followers = Number(input.followers || 0);
  const weighted = likes + comments * 2 + saves * 3 + shares * 3;

  return {
    brand_ig_id: input.brandIgId,
    post_id: input.postId,
    media_type: input.mediaType,
    posted_at: input.postedAt,
    caption_text: caption,
    first_line_text: caption.split('\n')[0] || '',
    hook_archetype: extractHookArchetype(caption),
    caption_length: caption.length,
    emoji_density: Number((emojis / Math.max(1, words)).toFixed(4)),
    cta_type: extractCta(caption),
    hashtag_placement: hashtagPlacement(caption),
    reading_grade: estimateReadingGrade(caption),
    has_question_hook: /\?/.test(caption.split('\n')[0] || ''),
    quality_weighted_engagement: Number(weighted.toFixed(4)),
    decay_half_life_hours: 24,
    reach_per_follower: Number((reach / Math.max(1, followers)).toFixed(6)),
    save_rate: Number((saves / Math.max(1, reach || likes + comments + 1)).toFixed(6)),
    share_rate: Number((shares / Math.max(1, reach || likes + comments + 1)).toFixed(6)),
    profile_visit_rate: 0,
    follow_conversion_rate: 0,
    likes,
    comments,
    saves,
    shares,
    reach,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertFingerprints(rows: ReturnType<typeof buildFingerprint>[]) {
  if (!rows.length) return;
  const sb = getServiceSupabase();
  await sb.from('post_fingerprints').upsert(rows, { onConflict: 'brand_ig_id,post_id' });
}

export async function computePillars(brandIgId: string) {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('post_fingerprints')
    .select('post_id,hook_archetype,cta_type,quality_weighted_engagement,save_rate,share_rate')
    .eq('brand_ig_id', brandIgId)
    .order('posted_at', { ascending: false })
    .limit(400);
  const rows = data ?? [];
  const buckets = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.hook_archetype || 'generic'}:${row.cta_type || 'none'}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const payload = Array.from(buckets.entries())
    .slice(0, 8)
    .map(([key, list]) => ({
      brand_ig_id: brandIgId,
      pillar_key: key,
      label: key.replace(':', ' / '),
      description: `Cluster of posts with ${key.replace(':', ' + ')} pattern.`,
      post_ids: list.map((r) => r.post_id),
      avg_quality_engagement:
        list.reduce((s, r) => s + Number(r.quality_weighted_engagement || 0), 0) /
        Math.max(1, list.length),
      avg_save_rate:
        list.reduce((s, r) => s + Number(r.save_rate || 0), 0) / Math.max(1, list.length),
      avg_share_rate:
        list.reduce((s, r) => s + Number(r.share_rate || 0), 0) / Math.max(1, list.length),
      sample_size: list.length,
      computed_at: new Date().toISOString(),
    }));
  if (payload.length) {
    await sb.from('content_pillars').upsert(payload, { onConflict: 'brand_ig_id,pillar_key' });
  }
  return payload;
}

function classifyComment(comment: string): { intent: string; sentiment: string; topic: string } {
  const text = comment.toLowerCase();
  const sentiment = /\blove|great|amazing|fire|wow|awesome\b/.test(text)
    ? 'positive'
    : /\bbad|hate|worse|boring|not good\b/.test(text)
      ? 'negative'
      : 'neutral';
  const intent = /\bprice|cost|how much\b/.test(text)
    ? 'purchase_intent'
    : /\bhow|what|where|why|when\b|\?/.test(text)
      ? 'question'
      : /\bneed|want|please|can you\b/.test(text)
        ? 'request'
        : 'other';
  const topic = /\bcolor|design|visual\b/.test(text)
    ? 'creative'
    : /\bprice|cost|budget\b/.test(text)
      ? 'pricing'
      : /\bwhen|schedule|time\b/.test(text)
        ? 'timing'
        : 'general';
  return { intent, sentiment, topic };
}

export async function ingestCommentIntelligence(
  brandIgId: string,
  comments: Array<{ postId: string; text: string }>,
) {
  if (!comments.length) return [];
  const grouped = new Map<string, { count: number; sample: string[]; postIds: Set<string> }>();
  for (const c of comments) {
    const cls = classifyComment(c.text);
    const key = `${cls.topic}:${cls.intent}:${cls.sentiment}`;
    const entry = grouped.get(key) || { count: 0, sample: [], postIds: new Set<string>() };
    entry.count += 1;
    if (entry.sample.length < 5) entry.sample.push(c.text.slice(0, 200));
    entry.postIds.add(c.postId);
    grouped.set(key, entry);
  }
  const rows = Array.from(grouped.entries()).map(([key, value]) => {
    const [topic, intent, sentiment] = key.split(':');
    return {
      brand_ig_id: brandIgId,
      post_id: Array.from(value.postIds)[0] || null,
      topic_key: topic,
      intent,
      sentiment,
      sample_comments: value.sample,
      mention_count: value.count,
      computed_at: new Date().toISOString(),
    };
  });
  const sb = getServiceSupabase();
  await sb.from('comment_clusters').insert(rows);
  return rows;
}

export async function runInsightDetectors(brandIgId: string) {
  const sb = getServiceSupabase();
  const [{ data: fp }, { data: pillars }, { data: comments }] = await Promise.all([
    sb
      .from('post_fingerprints')
      .select('post_id,quality_weighted_engagement,save_rate,share_rate,hook_archetype,posted_at')
      .eq('brand_ig_id', brandIgId)
      .order('posted_at', { ascending: false })
      .limit(120),
    sb
      .from('content_pillars')
      .select('pillar_key,label,avg_quality_engagement,sample_size')
      .eq('brand_ig_id', brandIgId)
      .order('avg_quality_engagement', { ascending: false })
      .limit(8),
    sb
      .from('comment_clusters')
      .select('topic_key,mention_count,intent,sentiment')
      .eq('brand_ig_id', brandIgId)
      .order('computed_at', { ascending: false })
      .limit(100),
  ]);

  const posts = fp ?? [];
  const findings: Array<Record<string, unknown>> = [];
  if (posts.length >= 6) {
    const latest =
      posts.slice(0, 6).reduce((s, p) => s + Number(p.quality_weighted_engagement || 0), 0) / 6;
    const prior =
      posts.slice(6, 12).reduce((s, p) => s + Number(p.quality_weighted_engagement || 0), 0) /
      Math.max(1, posts.slice(6, 12).length);
    const drift = prior ? ((latest - prior) / prior) * 100 : 0;
    if (drift <= -15) {
      findings.push({
        finding_type: 'DRIFT',
        severity: 'p1',
        title: 'Quality engagement is drifting down',
        summary: `Last 6 posts are ${drift.toFixed(1)}% below previous baseline.`,
        suggested_action:
          'Rotate top-performing pillar and refresh opening hooks for next 3 posts.',
        evidence_post_ids: posts.slice(0, 6).map((p) => p.post_id),
        evidence_metrics: { latest_avg: latest, previous_avg: prior, drift_pct: drift },
      });
    }
    const hookCounts = posts.slice(0, 12).reduce<Record<string, number>>((acc, p) => {
      const key = String(p.hook_archetype || 'generic');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const [topHook, topCount] = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0] || [
      'generic',
      0,
    ];
    if (topCount >= 8) {
      findings.push({
        finding_type: 'SATURATION',
        severity: 'p2',
        title: 'Hook pattern saturation detected',
        summary: `${topHook} is used in ${topCount}/12 recent posts.`,
        suggested_action: 'Ship at least two alternate hook archetypes this week.',
        evidence_post_ids: posts.slice(0, 12).map((p) => p.post_id),
        evidence_metrics: { dominant_hook: topHook, usage: topCount },
      });
    }
  }

  const bestPillar = (pillars ?? [])[0];
  if (bestPillar && Number(bestPillar.sample_size || 0) >= 3) {
    findings.push({
      finding_type: 'OPPORTUNITY',
      severity: 'p2',
      title: `Double down on ${bestPillar.label}`,
      summary: `${bestPillar.label} currently leads on quality engagement.`,
      suggested_action: 'Schedule two new pieces in this pillar inside the next 7 days.',
      evidence_post_ids: [],
      evidence_metrics: {
        pillar_key: bestPillar.pillar_key,
        avg_quality_engagement: bestPillar.avg_quality_engagement,
        sample_size: bestPillar.sample_size,
      },
    });
  }

  const pricingMentions = (comments ?? []).filter((c) => c.topic_key === 'pricing');
  if (pricingMentions.length >= 2) {
    findings.push({
      finding_type: 'GAP',
      severity: 'p3',
      title: 'Pricing clarity gap in comments',
      summary: 'Audience is repeatedly asking about pricing-related details.',
      suggested_action: 'Publish one pricing explainer post and pin it.',
      evidence_post_ids: [],
      evidence_metrics: {
        pricing_mentions: pricingMentions.reduce((s, c) => s + Number(c.mention_count || 0), 0),
      },
    });
  }

  if (findings.length) {
    await sb.from('insight_findings').insert(
      findings.map((f) => ({
        brand_ig_id: brandIgId,
        detector_version: 'brand-os-detectors-v1',
        created_at: new Date().toISOString(),
        ...f,
      })),
    );
  }

  return findings;
}

export async function generateDailyBrief(brandIgId: string) {
  const sb = getServiceSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const [findingsRes, snapshotsRes, pillarsRes, brandRes] = await Promise.all([
    sb
      .from('insight_findings')
      .select('finding_type,title,summary,suggested_action,evidence_metrics')
      .eq('brand_ig_id', brandIgId)
      .order('created_at', { ascending: false })
      .limit(6),
    sb
      .from('brand_snapshots')
      .select('engagement_rate,reach_7d,avg_saves,avg_shares,posts_per_week')
      .eq('brand_ig_id', brandIgId)
      .order('snapshot_date', { ascending: false })
      .limit(2),
    sb
      .from('content_pillars')
      .select('label,avg_quality_engagement')
      .eq('brand_ig_id', brandIgId)
      .order('avg_quality_engagement', { ascending: false })
      .limit(4),
    sb
      .from('brand_accounts')
      .select('ig_name,ig_username,ig_followers_count')
      .eq('ig_user_id', brandIgId)
      .maybeSingle(),
  ]);

  const findings = (findingsRes.data ?? []).slice(0, 5);
  const snapshots = snapshotsRes.data ?? [];
  const latest = snapshots[0];
  const previous = snapshots[1];
  const pillars = pillarsRes.data ?? [];
  const brand = brandRes.data;

  // Pull real metrics from post_fingerprints (last 30 days) instead of relying on snapshot zeros
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [fp30Res, fp7Res] = await Promise.all([
    sb
      .from('post_fingerprints')
      .select(
        'likes,comments,saves,shares,reach,posted_at,caption_text,hook_archetype,quality_weighted_engagement',
      )
      .eq('brand_ig_id', brandIgId)
      .gte('posted_at', thirtyDaysAgo)
      .order('quality_weighted_engagement', { ascending: false })
      .limit(50),
    sb
      .from('post_fingerprints')
      .select('likes,comments,saves,shares,reach,posted_at')
      .eq('brand_ig_id', brandIgId)
      .gte('posted_at', sevenDaysAgo)
      .limit(50),
  ]);
  const fp30 = fp30Res.data ?? [];
  const fp7 = fp7Res.data ?? [];
  const followers = Number(brand?.ig_followers_count ?? latest?.followers_count ?? 0) || 1;

  // Compute real metrics from fingerprints
  const computeMetrics = (fps: typeof fp30) => {
    if (!fps.length)
      return {
        engRate: 0,
        reach: 0,
        avgSaves: 0,
        avgShares: 0,
        postsPerWeek: 0,
        totalLikes: 0,
        totalComments: 0,
        count: 0,
      };
    const n = fps.length;
    const totalLikes = fps.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = fps.reduce((s, p) => s + (p.comments || 0), 0);
    const totalSaves = fps.reduce((s, p) => s + (p.saves || 0), 0);
    const totalShares = fps.reduce((s, p) => s + (p.shares || 0), 0);
    const totalReach = fps.reduce((s, p) => s + (p.reach || 0), 0);
    return {
      engRate: ((totalLikes + totalComments) / n / followers) * 100,
      reach: totalReach || (totalLikes + totalComments) * 5,
      avgSaves: totalSaves / n,
      avgShares: totalShares / n,
      postsPerWeek: n / 4.3,
      totalLikes,
      totalComments,
      count: n,
    };
  };

  const metrics30 = computeMetrics(fp30);
  const metrics7 = computeMetrics(fp7);

  // Use real fingerprint data, fall back to snapshot only if no fingerprints
  const engNow = metrics30.engRate || Number(latest?.engagement_rate ?? 0);
  const engPrev = Number(previous?.engagement_rate ?? 0);
  const reachNow = metrics30.reach || Number(latest?.reach_7d ?? 0);
  const reachPrev = Number(previous?.reach_7d ?? 0);
  const engDelta = engPrev ? ((engNow - engPrev) / engPrev) * 100 : 0;
  const reachDelta = reachPrev ? ((reachNow - reachPrev) / reachPrev) * 100 : 0;

  // Best performing posts for positive framing
  const bestPosts = fp30.slice(0, 3).map((p) => ({
    likes: p.likes,
    comments: p.comments,
    hook: p.hook_archetype,
    caption: (p.caption_text || '').slice(0, 80),
  }));

  let headline: string;
  let synopsis: string;
  let whyItHappened: string = '';
  let actions: Array<{ title: string; action: string; type: string }>;

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const userPrompt = buildDailyBriefUserPrompt({
      brandName: brand?.ig_name || 'Brand',
      handle: brand?.ig_username ? `@${brand.ig_username}` : '@brand',
      engagementRate: engNow,
      engagementDelta: engDelta,
      reach7d: reachNow,
      reachDelta: reachDelta,
      avgSaves: metrics30.avgSaves,
      avgShares: metrics30.avgShares,
      postsPerWeek: metrics7.count > 0 ? metrics7.count : metrics30.postsPerWeek,
      findings: findings.map((f) => ({
        type: f.finding_type,
        title: f.title,
        summary: f.summary,
      })),
      topPillars: pillars.map((p) => ({
        label: p.label,
        avgEngagement: Number(p.avg_quality_engagement ?? 0),
      })),
      bestPosts,
      totalPostsAnalysed: fp30.length,
    });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: DAILY_BRIEF_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    // Strip markdown code fences if present
    const cleanText = rawText.trim().startsWith('```')
      ? rawText
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/```\s*$/, '')
          .trim()
      : rawText.trim();
    const parsed = JSON.parse(cleanText);

    headline = parsed.headline || 'Weekly brand check-in';
    synopsis = parsed.whatHappened || 'Analysis complete.';
    whyItHappened = parsed.whyItHappened || '';
    const whatNext: string[] = Array.isArray(parsed.whatNext) ? parsed.whatNext.slice(0, 3) : [];
    actions = whatNext.map((a: string) => ({ title: a, action: a, type: 'recommendation' }));
  } catch (err) {
    console.error('[brand-os] LLM brief failed, using template fallback:', err);
    const top = findings.slice(0, 3);
    headline = top.length
      ? `${top[0].finding_type}: ${top[0].title}`
      : 'No critical shifts detected today';
    synopsis = top.length
      ? `Detected ${top.length} insight signals. Prioritize ${top[0].finding_type.toLowerCase()} action first.`
      : 'System is healthy; gather more data for stronger guidance.';
    actions = top.map((f) => ({
      title: f.title,
      action: f.suggested_action,
      type: f.finding_type,
    }));
  }

  const evidence = {
    whyItHappened,
    findings: findings.map((f) => ({
      type: f.finding_type,
      summary: f.summary,
      metrics: f.evidence_metrics,
    })),
  };

  await sb.from('daily_briefs').upsert(
    {
      brand_ig_id: brandIgId,
      brief_date: today,
      headline,
      synopsis,
      actions,
      evidence,
      prompt_version: BRAND_OS_PROMPT_VERSIONS.brief,
    },
    { onConflict: 'brand_ig_id,brief_date' },
  );

  return { headline, synopsis, actions, evidence };
}

export async function predictPerformance(
  brandIgId: string,
  input: {
    hook_archetype?: string;
    cta_type?: string;
    caption_length?: number;
    media_type?: string;
  },
) {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('post_fingerprints')
    .select('post_id,hook_archetype,cta_type,caption_length,media_type,quality_weighted_engagement')
    .eq('brand_ig_id', brandIgId)
    .order('posted_at', { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const scored = rows.map((r) => {
    let score = 0;
    if (input.hook_archetype && input.hook_archetype === r.hook_archetype) score += 2;
    if (input.cta_type && input.cta_type === r.cta_type) score += 2;
    if (input.media_type && input.media_type === r.media_type) score += 1;
    if (input.caption_length && r.caption_length) {
      const delta = Math.abs(input.caption_length - Number(r.caption_length));
      score += Math.max(0, 1 - delta / 200);
    }
    return { row: r, score };
  });
  const nearest = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((x) => x.score > 0);
  const prediction =
    nearest.reduce((s, n) => s + Number(n.row.quality_weighted_engagement || 0), 0) /
    Math.max(1, nearest.length);
  const confidence = Math.min(0.95, Math.max(0.2, nearest.length / 5));
  const riskFactors = [
    nearest.length < 3 ? 'Low similar history for this concept.' : null,
    input.caption_length && input.caption_length > 260
      ? 'Caption is longer than recent winners.'
      : null,
  ].filter(Boolean);

  const record = {
    brand_ig_id: brandIgId,
    prediction_input: input,
    predicted_engagement: Number(prediction.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    risk_factors: riskFactors,
    analog_post_ids: nearest.map((n) => n.row.post_id),
    model_version: 'brand-os-predict-v1',
  };
  await sb.from('performance_predictions').insert(record);
  return record;
}

export async function snapshotPostMetrics(brandIgId: string, bucketLabel: string) {
  const sb = getServiceSupabase();
  const { data: posts } = await sb
    .from('post_fingerprints')
    .select('post_id,likes,comments,saves,shares,reach')
    .eq('brand_ig_id', brandIgId)
    .order('posted_at', { ascending: false })
    .limit(100);
  const now = new Date().toISOString();
  const rows =
    posts?.map((p) => ({
      brand_ig_id: brandIgId,
      post_id: p.post_id,
      bucket_label: bucketLabel,
      captured_at: now,
      likes: Number(p.likes || 0),
      comments: Number(p.comments || 0),
      saves: Number(p.saves || 0),
      shares: Number(p.shares || 0),
      reach: Number(p.reach || 0),
    })) ?? [];
  if (rows.length) {
    await sb.from('post_metric_snapshots').insert(rows);
  }
  return rows.length;
}
