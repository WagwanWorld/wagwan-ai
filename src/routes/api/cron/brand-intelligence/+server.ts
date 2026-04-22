// src/routes/api/cron/brand-intelligence/+server.ts
export const config = { maxDuration: 120 };

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runBrandIntelligence } from '$lib/server/brandIntelligence';
import { computeTrajectory, generateWeeklyBrief } from '$lib/server/brandTrajectory';
import { fetchCompetitorData, analyseCompetitor, buildCompetitiveMatrix } from '$lib/server/brandCompetitors';
import { generateContentProposals, generateStrategyProposals, generateCreatorMatchProposals } from '$lib/server/brandProposals';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anthropicKey = process.env.ANTHROPIC_API_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  // Get all active brand accounts
  const brandsRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?select=ig_user_id,ig_username,ig_name,ig_access_token,ig_followers_count`,
    { headers },
  );
  const brands = brandsRes.ok ? await brandsRes.json() : [];
  const results: Array<{ brand: string; status: string; error?: string }> = [];

  for (const brand of brands) {
    try {
      console.log(`[Cron] Processing @${brand.ig_username}`);

      // 1. Fetch competitors for this brand
      const competitorsRes = await fetch(
        `${supabaseUrl}/rest/v1/brand_competitors?brand_ig_id=eq.${encodeURIComponent(brand.ig_user_id)}&select=*`,
        { headers },
      );
      const competitors = competitorsRes.ok ? await competitorsRes.json() : [];

      // 2. Analyse competitors
      let competitorSummary = '';
      const competitorAnalyses = [];
      for (const comp of competitors.slice(0, 5)) {
        if (!comp.competitor_ig_id) continue;
        const data = await fetchCompetitorData(comp.competitor_ig_id, brand.ig_access_token);
        if (data) {
          const analysis = await analyseCompetitor(data, anthropicKey);
          competitorAnalyses.push(analysis);
          // Update stored analysis
          await fetch(
            `${supabaseUrl}/rest/v1/brand_competitors?id=eq.${comp.id}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ latest_analysis: analysis, last_analysed_at: new Date().toISOString() }),
            },
          );
        }
      }
      if (competitorAnalyses.length > 0) {
        competitorSummary = competitorAnalyses
          .map(c => `@${c.username}: ${c.followers} followers, ${c.engagementRate}% eng, themes=${c.contentThemes.join('/')}`)
          .join('; ');
      }

      // 3. Run full intelligence pipeline
      const intelligence = await runBrandIntelligence(
        brand.ig_user_id,
        brand.ig_access_token,
        anthropicKey,
        competitorSummary,
      );

      // 4. Build competitive matrix
      let competitorData = {};
      if (competitorAnalyses.length > 0) {
        const matrix = await buildCompetitiveMatrix(
          { username: brand.ig_username, followers_count: brand.ig_followers_count, engagement_rate: intelligence.engagementRate },
          competitorAnalyses,
          anthropicKey,
        );
        competitorData = matrix;
      }

      // 5. Store snapshot
      const today = new Date().toISOString().split('T')[0];
      const snapshotPayload = {
        brand_ig_id: brand.ig_user_id,
        snapshot_date: today,
        followers: intelligence.profile.followers_count || 0,
        following: (intelligence.profile as any).follows_count || 0,
        media_count: intelligence.profile.media_count || 0,
        impressions_7d: intelligence.accountInsights.impressions7d,
        reach_7d: intelligence.accountInsights.reach7d,
        profile_views_7d: intelligence.accountInsights.profileViews7d,
        engagement_rate: intelligence.engagementRate,
        avg_likes: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.likes, 0) / intelligence.postInsights.length : 0,
        avg_comments: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.comments, 0) / intelligence.postInsights.length : 0,
        avg_saves: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.saved, 0) / intelligence.postInsights.length : 0,
        avg_shares: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.shares, 0) / intelligence.postInsights.length : 0,
        avg_reach: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.reach, 0) / intelligence.postInsights.length : 0,
        posts_per_week: intelligence.postsPerWeek,
        demographics: intelligence.demographics,
        content_performance: intelligence.contentPerformance,
        competitor_data: competitorData,
        intelligence: {
          identity: intelligence.identity,
          audiencePortrait: intelligence.audiencePortrait,
          strategicPositioning: intelligence.strategicPositioning,
          postingHeatmap: intelligence.postingHeatmap,
          bestHours: intelligence.bestHours,
          bestDays: intelligence.bestDays,
          topHashtags: intelligence.topHashtags,
        },
      };

      // Upsert snapshot (unique on brand_ig_id + snapshot_date)
      await fetch(
        `${supabaseUrl}/rest/v1/brand_snapshots`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(snapshotPayload),
        },
      );

      // 6. Compute trajectory
      const historyRes = await fetch(
        `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(brand.ig_user_id)}&order=snapshot_date.desc&limit=5`,
        { headers },
      );
      const history = historyRes.ok ? await historyRes.json() : [];
      const previousSnapshot = history.length > 1 ? history[1] : null;
      const trajectory = computeTrajectory(snapshotPayload, previousSnapshot, history);

      // 7. Generate weekly brief
      const brief = await generateWeeklyBrief(
        trajectory,
        snapshotPayload.intelligence,
        { username: brand.ig_username, name: brand.ig_name, followers_count: brand.ig_followers_count },
        anthropicKey,
      );

      await fetch(
        `${supabaseUrl}/rest/v1/brand_weekly_briefs`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            brand_ig_id: brand.ig_user_id,
            brief_date: today,
            headline: brief.headline,
            sections: brief.sections,
            key_metrics: brief.keyMetrics,
          }),
        },
      );

      // 8. Generate proposals (content + strategy + creator matches)
      const [contentProposals, strategyProposals, creatorProposals] = await Promise.all([
        generateContentProposals(intelligence, anthropicKey),
        generateStrategyProposals(trajectory, intelligence, anthropicKey),
        generateCreatorMatchProposals(intelligence, anthropicKey),
      ]);
      const allProposals = [...contentProposals, ...strategyProposals, ...creatorProposals];

      for (const proposal of allProposals) {
        await fetch(
          `${supabaseUrl}/rest/v1/brand_action_proposals`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              brand_ig_id: brand.ig_user_id,
              type: proposal.type,
              title: (proposal as any).title || '',
              payload: proposal,
              reasoning: (proposal as any).reasoning || '',
              urgency: (proposal as any).urgency || 'medium',
            }),
          },
        );
      }

      // 9. Expire old proposals (>2 weeks, still pending)
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
      await fetch(
        `${supabaseUrl}/rest/v1/brand_action_proposals?brand_ig_id=eq.${encodeURIComponent(brand.ig_user_id)}&status=eq.pending&created_at=lt.${twoWeeksAgo}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'expired' }),
        },
      );

      // 10. Update brand_identity on brand_accounts
      await fetch(
        `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(brand.ig_user_id)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            brand_identity: intelligence.identity,
            identity_updated_at: new Date().toISOString(),
            ig_followers_count: intelligence.profile.followers_count || brand.ig_followers_count,
          }),
        },
      );

      results.push({ brand: brand.ig_username, status: 'ok' });
    } catch (e) {
      console.error(`[Cron] Failed for @${brand.ig_username}:`, e);
      results.push({ brand: brand.ig_username, status: 'error', error: e instanceof Error ? e.message : 'Unknown' });
    }
  }

  return json({ ok: true, processed: results.length, results });
};
