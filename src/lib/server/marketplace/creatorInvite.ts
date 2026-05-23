import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreatorInviteAnalysis,
  CreatorInviteFitLabel,
  CreatorInviteLinks,
} from '$lib/types/creator-invite';
import type { ScrapedInstagramProfile } from './instagramScrape';
import type { RosterProfileSnapshot } from '$lib/types/creator-invite';
import {
  buildRosterProfileSnapshot,
  buildSimpleCreatorAnalysisRuleOnly,
  fallbackInviteMessage,
  mergeAnalysisWithFeedInsight,
  normalizeIgHandle,
  scrapeFromWagwanMatch,
  type WagwanCreatorMatch,
} from './creatorInviteUtils';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';

export {
  normalizeIgHandle,
  buildSimpleCreatorAnalysisRuleOnly,
  parseFollowerCount,
} from './creatorInviteUtils';
export type { WagwanCreatorMatch } from './creatorInviteUtils';

const MODEL = 'claude-haiku-4-5-20251001';

export function assertPublicBaseUrl(): string {
  const base = (PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    throw new Error('public_base_url_not_configured');
  }
  return base;
}

export function buildInviteLinks(
  brandId: string,
  rosterId: string,
  brandName: string,
  handle: string,
): CreatorInviteLinks {
  const base = assertPublicBaseUrl();
  const params = new URLSearchParams({
    brand: brandId,
    invite: rosterId,
    from: brandName.slice(0, 80),
  });
  return {
    onboarding: `${base}/onboarding?${params.toString()}`,
    instagramProfile: `https://www.instagram.com/${encodeURIComponent(handle)}/`,
    instagramApp: `instagram://user?username=${encodeURIComponent(handle)}`,
  };
}

export async function generateInviteWithAnalysis(ctx: {
  brandName: string;
  brandUsername: string;
  brandIdentity: Record<string, unknown> | null;
  scrape: ScrapedInstagramProfile;
  wagwan: WagwanCreatorMatch | null;
  ruleAnalysis: CreatorInviteAnalysis;
  onboardingUrl: string;
  handle: string;
}): Promise<{ inviteMessage: string; analysis: CreatorInviteAnalysis }> {
  const key = ANTHROPIC_API_KEY?.trim();
  if (!key) {
    const name = ctx.wagwan?.name || ctx.scrape.fullName;
    return {
      inviteMessage: fallbackInviteMessage(ctx.brandName, name, ctx.onboardingUrl),
      analysis: ctx.ruleAnalysis,
    };
  }

  const wagwanBlock = ctx.wagwan
    ? `On Wagwan: yes. Name: ${ctx.wagwan.name}. Signals: ${JSON.stringify(ctx.ruleAnalysis.signals)}`
    : 'On Wagwan: no (prospect from public scrape).';

  const prompt = `You help a brand invite a creator to join Wagwan.

Brand: ${ctx.brandName} (@${ctx.brandUsername})
Creator Instagram: @${ctx.handle} (${ctx.scrape.fullName})
Bio: ${ctx.scrape.bio || 'n/a'}
Followers: ${ctx.scrape.followers || 'unknown'}
${wagwanBlock}

Rule-based analysis (use as facts, do not invent scores):
${JSON.stringify(ctx.ruleAnalysis)}

Write JSON only:
{
  "summary": "1-2 sentences",
  "highlights": ["max 3 bullets"],
  "fitLabel": "Strong fit" | "Good fit" | "Worth exploring" | "Limited data",
  "inviteMessage": "120-160 word DM. Founder tone. No: excited, thrilled, amazing, love your content, partnership, collab, synergy, authentic. End with this exact URL on its own line:\\n${ctx.onboardingUrl}"
}`;

  try {
    const anthropic = new Anthropic({ apiKey: key, timeout: 60_000 });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.find((b) => b.type === 'text');
    if (text?.type !== 'text') throw new Error('no_text');
    const jsonMatch = text.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no_json');
    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      highlights?: string[];
      fitLabel?: CreatorInviteFitLabel;
      inviteMessage?: string;
    };
    const fitLabels: CreatorInviteFitLabel[] = [
      'Strong fit',
      'Good fit',
      'Worth exploring',
      'Limited data',
    ];
    const fitLabel = fitLabels.includes(parsed.fitLabel as CreatorInviteFitLabel)
      ? (parsed.fitLabel as CreatorInviteFitLabel)
      : ctx.ruleAnalysis.fitLabel;

    let inviteMessage = (parsed.inviteMessage ?? '').trim();
    if (!inviteMessage.includes(ctx.onboardingUrl)) {
      inviteMessage = `${inviteMessage}\n\n${ctx.onboardingUrl}`.trim();
    }

    return {
      inviteMessage:
        inviteMessage ||
        fallbackInviteMessage(ctx.brandName, ctx.scrape.fullName, ctx.onboardingUrl),
      analysis: {
        ...ctx.ruleAnalysis,
        summary: parsed.summary?.trim() || ctx.ruleAnalysis.summary,
        highlights: Array.isArray(parsed.highlights)
          ? parsed.highlights.slice(0, 3)
          : ctx.ruleAnalysis.highlights,
        fitLabel,
      },
    };
  } catch (e) {
    console.error('[creatorInvite] LLM failed:', e instanceof Error ? e.message : e);
    const name = ctx.wagwan?.name || ctx.scrape.fullName;
    return {
      inviteMessage: fallbackInviteMessage(ctx.brandName, name, ctx.onboardingUrl),
      analysis: ctx.ruleAnalysis,
    };
  }
}

export async function findUserByIgHandle(
  sb: SupabaseClient,
  handle: string,
): Promise<WagwanCreatorMatch | null> {
  const { data: rows } = await sb
    .from('user_profiles')
    .select('google_sub, name, profile_data, identity_graph')
    .limit(300);

  const lower = handle.toLowerCase();
  for (const row of rows ?? []) {
    const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
    const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
    const username = String(ig?.username ?? '').toLowerCase();
    if (username === lower) {
      return {
        google_sub: row.google_sub as string,
        name: (row.name as string) || '',
        profile_data: profileData,
        identity_graph: (row.identity_graph ?? {}) as Record<string, unknown>,
      };
    }
  }
  return null;
}

export async function resolveBrandForSession(
  sb: SupabaseClient,
  brandIgUserId: string | null,
  fallbackName: string,
): Promise<{
  brandId: string;
  brandName: string;
  brandUsername: string;
  brandIdentity: Record<string, unknown> | null;
}> {
  let brandId: string | null = null;
  let brandName = fallbackName;
  let brandUsername = '';
  let brandIdentity: Record<string, unknown> | null = null;

  if (brandIgUserId) {
    const { data: account } = await sb
      .from('brand_accounts')
      .select('brand_id, ig_username, ig_name, brand_identity')
      .eq('ig_user_id', brandIgUserId)
      .maybeSingle();
    if (account) {
      brandId = (account.brand_id as string) || null;
      brandName = (account.ig_name as string)?.trim() || brandName;
      brandUsername = (account.ig_username as string) || '';
      brandIdentity = (account.brand_identity as Record<string, unknown>) ?? null;
    }
  }

  if (!brandId) {
    const { data: existing } = await sb
      .from('brands')
      .select('id')
      .eq('name', brandName)
      .maybeSingle();
    if (existing?.id) brandId = existing.id as string;
  }

  if (!brandId) {
    const { data: created, error } = await sb
      .from('brands')
      .insert({ name: brandName })
      .select('id')
      .single();
    if (error || !created) throw new Error('brand_create_failed');
    brandId = created.id as string;
  }

  if (brandIgUserId) {
    await sb
      .from('brand_accounts')
      .update({ brand_id: brandId })
      .eq('ig_user_id', brandIgUserId)
      .is('brand_id', null);
  }

  return { brandId, brandName, brandUsername, brandIdentity };
}

export async function upsertBrandCreatorRoster(
  sb: SupabaseClient,
  row: {
    brand_id: string;
    ig_username: string;
    display_name: string;
    profile_snapshot: Record<string, unknown>;
    user_google_sub: string | null;
    invite_message: string;
    onboarding_url: string;
    analysis_snapshot: CreatorInviteAnalysis;
    status: 'prospect' | 'on_platform';
  },
): Promise<{ id: string }> {
  const now = new Date().toISOString();
  const { data: existing } = await sb
    .from('brand_creator_roster')
    .select('id, user_google_sub, status')
    .eq('brand_id', row.brand_id)
    .eq('ig_username', row.ig_username)
    .maybeSingle();

  if (existing?.id) {
    const linkedSub =
      typeof existing.user_google_sub === 'string' && existing.user_google_sub.trim()
        ? existing.user_google_sub
        : null;
    const preserveExistingLink = Boolean(linkedSub && linkedSub !== row.user_google_sub);
    const nextUserGoogleSub = preserveExistingLink ? linkedSub : row.user_google_sub;
    const nextStatus =
      existing.status === 'on_platform' && preserveExistingLink ? 'on_platform' : row.status;

    const { data: updated, error } = await sb
      .from('brand_creator_roster')
      .update({
        display_name: row.display_name,
        profile_snapshot: row.profile_snapshot,
        user_google_sub: nextUserGoogleSub,
        invite_message: row.invite_message,
        onboarding_url: row.onboarding_url,
        analysis_snapshot: row.analysis_snapshot,
        status: nextStatus,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error || !updated) throw new Error('roster_update_failed');
    return { id: updated.id as string };
  }

  const { data: inserted, error } = await sb
    .from('brand_creator_roster')
    .insert({
      ...row,
      delivery_status: 'draft',
      updated_at: now,
    })
    .select('id')
    .single();
  if (error || !inserted) throw new Error('roster_insert_failed');
  return { id: inserted.id as string };
}

async function persistRosterInvite(
  sb: SupabaseClient,
  ctx: {
    brandId: string;
    brandName: string;
    brandUsername: string;
    brandIdentity: Record<string, unknown> | null;
    handle: string;
    scrape: ScrapedInstagramProfile;
    wagwan: WagwanCreatorMatch | null;
  },
): Promise<{
  entry: Record<string, unknown>;
  profile: RosterProfileSnapshot;
  analysis: CreatorInviteAnalysis;
  inviteMessage: string;
  links: CreatorInviteLinks;
}> {
  const { brandId, brandName, brandUsername, brandIdentity, handle, scrape, wagwan } = ctx;

  const ruleAnalysis = buildSimpleCreatorAnalysisRuleOnly({
    scrape,
    wagwan,
    brandIdentity,
  });

  const status: 'prospect' | 'on_platform' = wagwan ? 'on_platform' : 'prospect';
  const profile_snapshot = buildRosterProfileSnapshot({ scrape, wagwan, handle });
  const analysisWithFeed = mergeAnalysisWithFeedInsight(ruleAnalysis, profile_snapshot.feedSummary);

  const draftLinks = buildInviteLinks(brandId, crypto.randomUUID(), brandName, handle);

  const { inviteMessage: draftMessage, analysis } = await generateInviteWithAnalysis({
    brandName,
    brandUsername,
    brandIdentity,
    scrape,
    wagwan,
    ruleAnalysis: analysisWithFeed,
    onboardingUrl: draftLinks.onboarding,
    handle,
  });

  const finalAnalysis = mergeAnalysisWithFeedInsight(analysis, profile_snapshot.feedSummary);

  const { id: rosterId } = await upsertBrandCreatorRoster(sb, {
    brand_id: brandId,
    ig_username: handle,
    display_name: wagwan?.name || scrape.fullName,
    profile_snapshot,
    user_google_sub: wagwan?.google_sub ?? null,
    invite_message: draftMessage,
    onboarding_url: draftLinks.onboarding,
    analysis_snapshot: finalAnalysis,
    status,
  });

  const links = buildInviteLinks(brandId, rosterId, brandName, handle);
  const finalMessage = draftMessage.replace(draftLinks.onboarding, links.onboarding);
  const messageWithLink = finalMessage.includes(links.onboarding)
    ? finalMessage
    : `${finalMessage}\n\n${links.onboarding}`;

  await sb
    .from('brand_creator_roster')
    .update({
      onboarding_url: links.onboarding,
      invite_message: messageWithLink,
    })
    .eq('id', rosterId);

  const { data: entry } = await sb
    .from('brand_creator_roster')
    .select('*')
    .eq('id', rosterId)
    .single();

  // Insert creator-facing signal if creator is on-platform
  if (wagwan?.google_sub) {
    void upsertCreatorBrandSignal(sb, {
      creator_google_sub: wagwan.google_sub,
      signal_type: 'roster_add',
      brand_id: brandId,
      roster_entry_id: rosterId,
      brand_name: brandName,
      brand_handle: brandUsername ?? null,
      brand_profile_picture: null,
      invite_message: messageWithLink,
      fit_label: finalAnalysis.fitLabel ?? null,
      fit_score: finalAnalysis.fitScore ?? null,
      analysis_snapshot: finalAnalysis as unknown as Record<string, unknown>,
    });
  }

  return {
    entry: (entry ?? {}) as Record<string, unknown>,
    profile: profile_snapshot,
    analysis: finalAnalysis,
    inviteMessage: messageWithLink,
    links,
  };
}

export async function processCreatorInvite(
  sb: SupabaseClient,
  brandIgUserId: string | null,
  instagramInput: string,
  scrapeFn: (h: string) => Promise<ScrapedInstagramProfile | null>,
): Promise<{
  entry: Record<string, unknown>;
  profile: Record<string, unknown>;
  analysis: CreatorInviteAnalysis;
  inviteMessage: string;
  links: CreatorInviteLinks;
}> {
  const handle = normalizeIgHandle(instagramInput);
  if (!handle) throw new Error('invalid_handle');

  assertPublicBaseUrl();

  const scrape = await scrapeFn(handle);
  if (!scrape) throw new Error('profile_not_found');

  const wagwan = await findUserByIgHandle(sb, handle);
  const { brandId, brandName, brandUsername, brandIdentity } = await resolveBrandForSession(
    sb,
    brandIgUserId,
    'Brand',
  );

  return persistRosterInvite(sb, {
    brandId,
    brandName,
    brandUsername,
    brandIdentity,
    handle,
    scrape,
    wagwan,
  });
}

export async function processAddNetworkToRoster(
  sb: SupabaseClient,
  brandIgUserId: string | null,
  instagramInput: string,
  scrapeFn: (h: string) => Promise<ScrapedInstagramProfile | null>,
): Promise<{
  entry: Record<string, unknown>;
  profile: RosterProfileSnapshot;
  analysis: CreatorInviteAnalysis;
  inviteMessage: string;
  links: CreatorInviteLinks;
}> {
  const handle = normalizeIgHandle(instagramInput);
  if (!handle) throw new Error('invalid_handle');

  assertPublicBaseUrl();

  const wagwan = await findUserByIgHandle(sb, handle);
  if (!wagwan) throw new Error('not_on_platform');

  let scrape = scrapeFromWagwanMatch(wagwan, handle);
  const needsGapFill = !scrape.followers && !scrape.posts;
  if (needsGapFill) {
    const htmlScrape = await scrapeFn(handle);
    if (htmlScrape) {
      scrape = {
        ...scrape,
        followers: scrape.followers || htmlScrape.followers,
        following: scrape.following || htmlScrape.following,
        posts: scrape.posts || htmlScrape.posts,
        bio: scrape.bio || htmlScrape.bio,
        isVerified: scrape.isVerified || htmlScrape.isVerified,
        profilePictureUrl: scrape.profilePictureUrl || htmlScrape.profilePictureUrl,
        recentCaptions:
          scrape.recentCaptions.length > 0 ? scrape.recentCaptions : htmlScrape.recentCaptions,
      };
    }
  }

  const { brandId, brandName, brandUsername, brandIdentity } = await resolveBrandForSession(
    sb,
    brandIgUserId,
    'Brand',
  );

  return persistRosterInvite(sb, {
    brandId,
    brandName,
    brandUsername,
    brandIdentity,
    handle,
    scrape,
    wagwan,
  });
}
