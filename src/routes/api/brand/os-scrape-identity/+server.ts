import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';
import { scrapeWebsiteIdentity } from '$lib/server/brand/websiteScraper';
import { generateBrandMockups } from '$lib/server/brand/mockupGenerator';
import type { BrandScheme } from '$lib/types/brand-os';

/** Extract a brand name from a URL as fallback */
function brandName(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '').split('.')[0];
  } catch {
    return 'Brand';
  }
}

/** Strip markdown code fences from LLM output before JSON.parse */
function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return s;
}

/**
 * Orchestrates URL resolution → scraping → LLM refinement → storage.
 *
 * POST /api/brand/os-scrape-identity
 * Body: { websiteUrl?: string }
 *
 * Resolves the website URL from body → brand_identity → intel.identity,
 * scrapes raw brand signals, refines them with Claude Haiku, and stores
 * the resulting BrandScheme in brand_snapshots.intelligence.brandScheme.
 */
export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json().catch(() => ({}));

  const sb = getServiceSupabase();

  // Load brand account + latest snapshot in parallel
  const [brandRes, snapRes] = await Promise.all([
    sb
      .from('brand_accounts')
      .select('ig_name,ig_username,ig_followers_count,brand_identity,ig_access_token')
      .eq('ig_user_id', igUserId)
      .maybeSingle(),
    sb
      .from('brand_snapshots')
      .select('id,intelligence')
      .eq('brand_ig_id', igUserId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!brandRes.data) return json({ ok: false, error: 'Brand account not found.' }, { status: 404 });
  if (!snapRes.data) return json({ ok: false, error: 'No snapshot found. Run initial data sync first.' }, { status: 400 });

  const brand = brandRes.data;
  const snapshot = snapRes.data;
  const intel = (snapshot.intelligence as Record<string, unknown>) || {};
  const identity = (intel.identity as Record<string, unknown>) || {};
  const brandIdentity = (brand.brand_identity as Record<string, unknown>) || {};

  // Resolve URL: body → brand_identity.website → intel.identity.website → previous brandScheme.sourceUrl
  const previousScheme = (intel.brandScheme as Record<string, unknown>) || {};
  const resolvedUrl =
    (body?.websiteUrl as string | undefined) ||
    (brandIdentity.website as string | undefined) ||
    (identity.website as string | undefined) ||
    (previousScheme.sourceUrl as string | undefined);

  if (!resolvedUrl) {
    return json({ ok: false, error: 'No website URL found. Provide websiteUrl in body or set one in your brand profile.' }, { status: 400 });
  }

  try {
    // Step 1: Scrape the website
    console.log(`[os-scrape-identity] Scraping ${resolvedUrl} for brand ${igUserId}`);
    const scraped = await scrapeWebsiteIdentity(resolvedUrl);

    // Step 2: Build Instagram context
    const igContext = [
      `Brand name: ${brand.ig_name || 'Unknown'}`,
      `Instagram handle: @${brand.ig_username || 'unknown'}`,
      `Followers: ${brand.ig_followers_count ?? 0}`,
      identity.rawSummary ? `Bio/Summary: ${identity.rawSummary}` : null,
      Array.isArray(identity.interests) && (identity.interests as string[]).length > 0
        ? `Interests: ${(identity.interests as string[]).join(', ')}`
        : null,
      identity.aesthetic ? `Aesthetic: ${identity.aesthetic}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Step 3: Call Claude Haiku to refine scraped data into BrandScheme
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const prompt = `You are a brand identity designer. Analyse the raw website data below and produce a structured brand scheme.

## Raw website signals
Colors (hex, frequency from CSS):
${scraped.colors.slice(0, 20).map(c => `  ${c.hex} (freq: ${c.frequency})`).join('\n') || '  (none found)'}

Fonts detected:
${scraped.fonts.map(f => `  ${f.family} [${f.source}]`).join('\n') || '  (none found)'}

Logo URLs: ${scraped.logoUrls.length > 0 ? scraped.logoUrls.join(', ') : '(none)'}
Favicon URL: ${scraped.faviconUrl || '(none)'}
Tagline / meta description: ${scraped.tagline || '(none)'}
Page title: ${scraped.title || '(none)'}
OG image: ${scraped.ogImage || '(none)'}

## Instagram context
${igContext}

## Instructions
1. Pick 4-6 of the most visually distinctive and brand-representative colors. Exclude near-black (#000–#111) and near-white (#eee–#fff) unless they are clearly the dominant brand color.
2. Give each color a single evocative word name (e.g. "Midnight", "Coral", "Sage") — not generic names like "Blue" or "Color1".
3. Assign each color exactly one role from: primary | secondary | accent | neutral | background.
4. From the fonts list, identify the heading font (display/title use) and body font (paragraph/UI use). If only one font is found, use it for both. If none found, use "Inter" (system) for both.
5. Clean up the tagline: if it is longer than 120 characters or too generic, shorten it to a punchy 1-line brand statement. If none exists, generate one from the brand context.
6. For each logo URL provided, assign it to darkUrl or lightUrl based on your best guess (use ogImage or first logoUrl as darkUrl if unsure). Use faviconUrl for faviconUrl.
7. Write a 1-2 sentence application description for each format: Instagram Post, Business Card, Website Header, Social Banner.

Output ONLY valid JSON with this exact structure (no markdown, no prose):
{
  "palette": [
    { "name": "string", "hex": "#rrggbb", "role": "primary|secondary|accent|neutral|background" }
  ],
  "typography": {
    "heading": { "family": "string", "weights": [400, 700], "source": "google|adobe|system|custom" },
    "body": { "family": "string", "weights": [400], "source": "google|adobe|system|custom" }
  },
  "tagline": "string or null",
  "logo": {
    "darkUrl": "string or null",
    "lightUrl": "string or null",
    "faviconUrl": "string or null"
  },
  "applications": {
    "igPost": "string",
    "businessCard": "string",
    "websiteHeader": "string",
    "socialBanner": "string"
  }
}`;

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = res.content[0].type === 'text' ? res.content[0].text : '{}';
    const parsed = JSON.parse(extractJson(rawText));

    // Step 4: Construct BrandScheme with fallbacks for missing LLM fields
    const defaultFont = { family: 'Inter', weights: [400], source: 'system' as const };

    const brandScheme: BrandScheme = {
      scrapedAt: new Date().toISOString(),
      sourceUrl: resolvedUrl,
      logo: {
        darkUrl: parsed?.logo?.darkUrl ?? scraped.logoUrls[0] ?? null,
        lightUrl: parsed?.logo?.lightUrl ?? null,
        faviconUrl: parsed?.logo?.faviconUrl ?? scraped.faviconUrl ?? null,
      },
      palette: Array.isArray(parsed?.palette) && parsed.palette.length > 0
        ? parsed.palette
        : scraped.colors.slice(0, 4).map((c, i) => ({
            name: `Color${i + 1}`,
            hex: c.hex,
            role: (['primary', 'secondary', 'accent', 'neutral'] as const)[i] ?? 'accent',
          })),
      typography: {
        heading: parsed?.typography?.heading ?? scraped.fonts[0] ?? defaultFont,
        body: parsed?.typography?.body ?? scraped.fonts[1] ?? scraped.fonts[0] ?? defaultFont,
      },
      tagline: parsed?.tagline ?? scraped.tagline ?? null,
      applications: {
        igPost: { description: parsed?.applications?.igPost ?? 'Brand-aligned square post with primary color background.' },
        businessCard: { description: parsed?.applications?.businessCard ?? 'Clean card using brand palette and heading font.' },
        websiteHeader: { description: parsed?.applications?.websiteHeader ?? 'Full-width hero with brand colors and logo.' },
        socialBanner: { description: parsed?.applications?.socialBanner ?? 'Wide banner using primary and accent colors.' },
      },
    };

    // Step 5: Store initial brandScheme (without mockup images yet)
    intel.brandScheme = brandScheme;
    await sb.from('brand_snapshots').update({ intelligence: intel }).eq('id', snapshot.id);

    console.log(`[os-scrape-identity] Brand scheme saved for ${igUserId}: ${brandScheme.palette.length} colors, ${scraped.fonts.length} fonts`);

    // Step 6: Generate mockup images with GPT (async, non-blocking for initial response)
    // We fire this off and update the scheme in the background
    generateBrandMockups(brandScheme, brand.ig_name || brandName(resolvedUrl), igUserId)
      .then(async (mockups) => {
        brandScheme.applications = mockups;
        intel.brandScheme = brandScheme;
        await sb.from('brand_snapshots').update({ intelligence: intel }).eq('id', snapshot.id);
        console.log(`[os-scrape-identity] Mockup images saved for ${igUserId}`);
      })
      .catch((err) => {
        console.error('[os-scrape-identity] Mockup generation failed (non-fatal):', err);
      });

    return json({ ok: true, brandScheme });
  } catch (err) {
    console.error('[os-scrape-identity] Error:', err);
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to scrape website',
      },
      { status: 500 },
    );
  }
};
