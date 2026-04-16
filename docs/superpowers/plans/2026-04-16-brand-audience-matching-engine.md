# Brand Audience Matching Engine — Implementation Plan
**Branch:** claude/inspiring-golick  
**Spec:** `/Users/madhviknemani/Downloads/wagwan_brand_engine_spec.docx`  
**Date:** 2026-04-16

## Project Context

SvelteKit app. Server logic in `src/lib/server/`. API routes in `src/routes/api/`.  
Supabase client: `getServiceSupabase()` from `$lib/server/supabase`.  
Anthropic client: `new Anthropic({ apiKey: ANTHROPIC_API_KEY })` from `$env/static/private`.  
Use `claude-haiku-4-5-20251001` for fast inference, `claude-sonnet-4-5` for NLP parsing and cohort labeling.

**Privacy rule (non-negotiable):** Brands NEVER receive individual user PII — only cohort labels, match counts, aggregate signals.

---

## Task 1 — DB Schema Migration

**File:** `supabase/migrations/20260416_brand_engine.sql`

Create 4 tables:

```sql
CREATE TABLE brand_queries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         text NOT NULL,
  brand_name       text,
  raw_prompt       text NOT NULL,
  parsed_intent    jsonb NOT NULL,
  expanded_signals jsonb,
  result_summary   jsonb,
  match_count      integer DEFAULT 0,
  cohort_count     integer DEFAULT 0,
  processing_ms    integer,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE brand_audience_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id          uuid REFERENCES brand_queries(id) ON DELETE CASCADE,
  user_google_sub   text NOT NULL,
  match_tier        integer NOT NULL CHECK (match_tier BETWEEN 1 AND 5),
  match_score       float NOT NULL,
  match_confidence  float NOT NULL,
  cohort_id         text,
  matched_signals   jsonb NOT NULL,
  correlation_paths jsonb,
  explanation       text,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_bam_query ON brand_audience_matches(query_id, match_score DESC);
CREATE INDEX idx_bam_user  ON brand_audience_matches(user_google_sub);
CREATE INDEX idx_bam_tier  ON brand_audience_matches(query_id, match_tier);

CREATE TABLE correlation_index (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a        text NOT NULL,
  signal_a_cat    text NOT NULL,
  signal_b        text NOT NULL,
  signal_b_cat    text NOT NULL,
  correlation_r   float NOT NULL,
  support_count   integer NOT NULL,
  lift            float NOT NULL,
  confidence      float NOT NULL,
  domain_distance integer NOT NULL,
  last_computed   timestamptz DEFAULT now(),
  is_active       boolean DEFAULT true,
  source          text DEFAULT 'discovered'
);
CREATE UNIQUE INDEX idx_corr_unique ON correlation_index(signal_a, signal_b);
CREATE INDEX idx_corr_a    ON correlation_index(signal_a, correlation_r DESC);
CREATE INDEX idx_corr_cat  ON correlation_index(signal_a_cat, signal_b_cat);
CREATE INDEX idx_corr_lift ON correlation_index(lift DESC) WHERE is_active = true;

CREATE TABLE brand_cohorts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id        uuid REFERENCES brand_queries(id) ON DELETE CASCADE,
  cohort_id       text NOT NULL,
  label           text NOT NULL,
  description     text,
  user_count      integer NOT NULL,
  avg_match_score float,
  avg_confidence  float,
  top_signals     jsonb,
  centroid_vector jsonb,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_matching_opt_out boolean DEFAULT false;
```

Also seed `correlation_index` with the 12 cultural seed rows (source='seed_cultural'):

| signal_a | signal_a_cat | signal_b | signal_b_cat | correlation_r | support_count | lift | confidence | domain_distance |
|---|---|---|---|---|---|---|---|---|
| Justin Bieber | music genre cluster | streetwear | instagram descriptor | 0.45 | 100 | 2.4 | 0.65 | 3 |
| AP Dhillon | music genre cluster | luxury fashion | brand vibe | 0.42 | 80 | 2.1 | 0.60 | 3 |
| indie | music genre | film photography | instagram interest | 0.58 | 120 | 3.1 | 0.72 | 2 |
| ghazal | music genre | fine dining | lifestyle signal | 0.38 | 60 | 1.9 | 0.55 | 3 |
| Raj Shamani | music genre cluster | SaaS tools | profile interest | 0.52 | 90 | 2.8 | 0.70 | 3 |
| design school | profile interest | film aesthetic | instagram descriptor | 0.50 | 85 | 2.6 | 0.68 | 2 |
| Zach Bryan | music genre cluster | outdoor gear | profile interest | 0.44 | 75 | 2.2 | 0.61 | 3 |
| morning worker | calendar pattern | protein supplement | lifestyle signal | 0.40 | 70 | 2.0 | 0.58 | 2 |
| founder | professional identity | premium productivity | brand vibe | 0.60 | 150 | 3.4 | 0.78 | 2 |
| travel planner | calendar pattern | audio gear | brand vibe | 0.36 | 65 | 1.8 | 0.53 | 2 |
| high engagement | instagram pattern | brand collaboration | lifestyle signal | 0.54 | 110 | 2.9 | 0.71 | 1 |
| streetwear | instagram descriptor | Justin Bieber | music genre cluster | 0.45 | 100 | 1.8 | 0.55 | 3 |

---

## Task 2 — Shared Types

**File:** `src/lib/server/brand/types.ts`

```typescript
export type IntentType = 'purchase' | 'action' | 'identity' | 'taste' | 'growth';
export type ContextMode = 'morning_professional' | 'weekend_exploration' | 'evening_social' | 'late_night_creative';

export interface BrandQueryIntent {
  target_genres?: string[];
  target_aesthetics?: string[];
  target_interests?: string[];
  target_brands?: string[];
  target_artists?: string[];
  target_lifestyle?: string[];
  target_intent_type?: IntentType;
  target_purchase_category?: string;
  target_momentum_min?: number;
  target_creator_tier?: string;
  target_engagement_tier?: string;
  target_cities?: string[];
  target_budget?: ('low' | 'mid' | 'high')[];
  target_career_stage?: string[];
  target_context_mode?: ContextMode;
  target_purchase_window?: string;
  min_tier: 1 | 2 | 3 | 4 | 5;
  max_results: number;
  cohort_count: number;
  include_correlations: boolean;
  explain_matches: boolean;
  raw_prompt: string;
  parsed_at: string;
  confidence: number;
}

export interface MatchResult {
  user_google_sub: string;
  match_tier: 1 | 2 | 3 | 4 | 5;
  match_score: number;
  match_confidence: number;
  matched_signals: Array<Record<string, unknown>>;
  correlation_paths?: Array<{
    from: string;
    to: string;
    lift?: number;
    confidence?: number;
    domain_distance?: number;
  }>;
  last_sync_days?: number;
  momentum_score?: number;
  purchase_intent_score?: number;
}

export interface ExpandedSignal {
  value: string;
  category: string;
  weight: number;
  source: 'direct' | 'correlation';
  correlation_from?: string;
  lift?: number;
  confidence?: number;
  domain_distance?: number;
}

export interface CohortResult {
  cohort_id: string;
  label: string;
  description: string;
  user_count: number;
  avg_match_score: number;
  avg_confidence: number;
  top_signals: WeightedSignal[];
  centroid_vector: number[];
}

export interface MatchedUser {
  user_google_sub: string;
  match_tier: number;
  match_score: number;
  cohort_id: string;
  explanation?: string;
}

export interface SignalCoverage {
  total_signals_searched: number;
  signals_with_matches: string[];
  correlation_expansions_used: number;
}

export interface AudienceMatchResponse {
  query_id: string;
  total_matched: number;
  cohorts: CohortResult[];
  tier_breakdown: Record<number, number>;
  top_users: MatchedUser[];
  signal_coverage: SignalCoverage;
  processing_ms: number;
  correlation_expansions: ExpandedSignal[];
}

export interface WeightedSignal {
  value: string;
  category: string;
  final_score: number;
}

export interface LookalikeResult {
  user_google_sub: string;
  similarity_score: number;
  source: 'lookalike';
}

export interface CohortSignalReport {
  coverage: Record<string, number>;
  differentiators: WeightedSignal[];
  total_users: number;
}

export interface CorrelationInsert {
  signal_a: string;
  signal_a_cat: string;
  signal_b: string;
  signal_b_cat: string;
  correlation_r: number;
  support_count: number;
  lift: number;
  confidence: number;
  domain_distance: number;
}
```

---

## Task 3 — Brand Prompt Parser

**File:** `src/lib/server/brand/brandPromptParser.ts`

Implement `parseBrandPrompt(prompt: string): Promise<BrandQueryIntent>`.  
Uses `claude-sonnet-4-5` with the system prompt from Section 2.2 of the spec.  
Import `ANTHROPIC_API_KEY` from `$env/static/private`. Instantiate `new Anthropic({ apiKey: ANTHROPIC_API_KEY })`.  
Apply defaults: `min_tier: 3`, `max_results: 500`, `cohort_count: 4`, `include_correlations: true`, `explain_matches: true`.

---

## Task 4 — Audience Matcher (5 tiers + scoring)

**File:** `src/lib/server/brand/audienceMatcher.ts`

Implement all 5 matching functions + scoring helpers from the spec:
- `matchDirectSignals(intent)` — Tier 1: ilike on `user_identity_claims.assertion`, semantic embedding via `match_identity_claims_semantic` RPC (threshold 0.82)
- `matchInferenceLayer(intent, existingMatches)` — Tier 2: semantic on `narrative` claim_kind (threshold 0.75) + intent classification
- `matchBehavioralPatterns(intent, existingMatches)` — Tier 3: `graph_fact` claim_kind with salience ≥ 40
- `matchCorrelatedSignals(expandedSignals, existingMatches)` — Tier 4: uses correlation-derived signals
- `matchLooseAssociations(intent, expandedSignals, existingMatches)` — Tier 5: broad fallback at score × 0.45
- `computeCompositeScore(user, intent)` — scoring math from Section 14: tier weights [1.0, 0.85, 0.75, 0.65, 0.45] + multi-signal boost + recency boost + momentum boost + purchase boost
- `mergeAllTiers(tierResults)` — deduplicate by user, keep highest tier and score
- `rankAndScore(results, intent)` — apply composite scoring, sort desc, cap at intent.max_results
- `deduplicateByUser(results)` — keep first/highest per user
- `mergeMatchResults(into, newResults, tier, scoreMultiplier)` — helper
- `buildDomainQueries(intent)` — for Tier 2
- `buildBehavioralClaimQueries(intent)` — for Tier 3

Privacy: fetch opted-out users from `profiles` where `brand_matching_opt_out = true` and exclude them from all results. Do this once at the start.

Note: `embedTexts` — use a simple stub `async function embedTexts(texts: string[]): Promise<number[][]>` that returns `[]` arrays for now (pgvector embedding generation is future work). The semantic match RPC calls can be gracefully skipped if embeddings are empty.

Use `getServiceSupabase()` from `$lib/server/supabase`.

---

## Task 5 — Correlation Expander

**File:** `src/lib/server/brand/correlationExpander.ts`

Implement `expandQueryWithCorrelations(intent, maxExpansions = 20): Promise<ExpandedSignal[]>` from Section 5.2 of spec.

Maps intent fields to direct signals with categories:
- `target_genres` → category `'music genre'`
- `target_aesthetics` → category `'instagram descriptor'`
- `target_interests` → category `'profile interest'`
- `target_artists` → category `'music genre cluster'`
- `target_brands` → category `'brand vibe'`

For each direct signal, queries `correlation_index` for top correlates by lift (≥ 1.3, is_active = true, limit 10).

Weight formula: `distancePenalty = [0.90, 0.70, 0.45][domain_distance - 1]`, `liftBoost = min((lift - 1.0) / 3.0, 0.25)`, final weight capped at 0.85.

---

## Task 6 — Cohort Builder

**File:** `src/lib/server/brand/cohortBuilder.ts`

Implement from Section 6:
- `VECTOR_DIMENSIONS` — 18-element const array (music_genre, music_artist, aesthetic, lifestyle, brand_affinity, career_stage, creator_tier, engagement, budget, city_tier, purchase_intent, travel_affinity, fitness_wellness, tech_media, social_creator, content_consumption, temporal_morning, temporal_evening)
- `buildUserSignalVectors(userIds)` — fetch `identity_graphs` (google_sub, signal_meter, inference_identity), map signals + life_domains to vector
- `mapSignalToDimension(category, value)` — returns dimension index or -1
- `mapDomainToDimension(domainId)` — returns dimension index or -1
- `kMeansClusters(vectors, k)` — k-means++ seeding + 50 iteration convergence, returns Map<user, cohort_id>
- `kMeansPlusPlusSeed(vecs, k)` — proper k-means++ initialization
- `euclideanDistance(a, b)` — L2 distance
- `cosineSimilarity(a, b)` — cosine similarity
- `buildVectorFromSignalMeter(signalMeter)` — same mapping logic as buildUserSignalVectors
- `labelCohort(cohortSignals, cohortSize, queryContext)` — calls claude-sonnet-4-5 per spec Section 6.3
- `buildLabeledCohorts(clusterAssignments, rankedResults, vectors, rawPrompt)` — full cohort assembly

---

## Task 7 — Match Explainer + Lookalike Expander

### File 1: `src/lib/server/brand/matchExplainer.ts`

Implement from Section 8:
- `generateMatchExplanation(user, intent, expandedSignals)` — deterministic string explanations by tier (no LLM call needed, use the template strings from the spec)
- `buildCohortSignalReport(cohortUsers, allCohortUsers, intent)` — signal coverage % + differentiating signals
- `findDifferentiatingSignals(cohortUsers, otherUsers)` — signals more common in this cohort vs others

### File 2: `src/lib/server/brand/lookalikeExpander.ts`

Implement from Section 9:
- `expandToLookalikes(confirmedCohortIds, queryId, expansionFactor = 3)` — fetch cohort centroids, compute weighted average centroid, cosine similarity against all identity_graphs users not already matched, return top N above 0.55 threshold

---

## Task 8 — Correlation Discovery + Seed Data

### File 1: `src/lib/server/brand/correlationDiscovery.ts`

Implement from Section 5.1:
- `runCorrelationDiscovery()` — fetch all identity_graphs with signal_meter, build signal presence matrix, compute pairwise Apriori association rules (lift ≥ 1.3, confidence ≥ 0.15, min support 3 co-occurrences, min 5 users per signal), batch upsert to correlation_index (500/batch)
- `normalizeSignalKey(value, category)` — lowercase + trim, returns `${normalized}::${category}`
- `computePearsonR(usersA, usersB, N)` — proper Pearson r for binary presence vectors
- `computeDomainDistance(catA, catB)` — from spec Section 5.1 (DOMAIN_MAP + ADJACENT map)

Requires minimum 50 users (log and return early if below threshold).

### File 2: `src/lib/server/brand/seedCorrelations.ts`

Export `SEED_CORRELATIONS: CorrelationInsert[]` — the 11 hand-coded cultural correlations from Section 12 of spec, plus their bidirectional counterparts where not already included. Mark source='seed_cultural' (add to the upsert payload).

Also export `async function seedCorrelationIndex()` that upserts all seeds to `correlation_index` with `onConflict: 'signal_a,signal_b'`.

---

## Task 9 — Full Pipeline Orchestrator

**File:** `src/lib/server/brand/audienceMatchingPipeline.ts`

Implement from Section 7:
- `runAudienceMatchingPipeline(prompt, brandId, onProgress?)` → `AudienceMatchResponse`

Steps in order:
1. `parseBrandPrompt(prompt)`
2. `expandQueryWithCorrelations(intent)`
3. Run Tier 1+2+3 in `Promise.all` (each with empty existingMatches set since they're independent)
4. Collect matched user IDs into Set
5. Run Tier 4 if `intent.min_tier <= 4 || matchedSoFar.size < 30`
6. Run Tier 5 if `matchedSoFar.size < 20 || intent.min_tier <= 5`
7. `mergeAllTiers` → `rankAndScore`
8. `buildUserSignalVectors(userIds)` then `kMeansClusters(vectors, k)` where k = `min(cohort_count, max(2, floor(userIds.length / 15)))`
9. `buildLabeledCohorts(clusterAssignments, rankedResults, vectors, prompt)`
10. Persist to `brand_queries` + `brand_audience_matches` + `brand_cohorts` via Supabase
11. Return `AudienceMatchResponse`

Also export `persistAudienceMatch(...)` as a named helper.

---

## Task 10 — API Routes

### `src/routes/api/brand/match/+server.ts`
POST handler. Validates prompt (≥ 10 chars). Streams SSE: progress events `{step, count}`, then final `{done: true, result}` or `{error}`. Content-Type: `text/event-stream`. Calls `runAudienceMatchingPipeline(prompt, brand_id, emit)`.

### `src/routes/api/brand/expand/+server.ts`
POST handler. Reads `{query_id, confirmed_cohort_ids, expansion_factor}`. Calls `expandToLookalikes`. Returns `{lookalikes, count}`.

### `src/routes/api/brand/correlations/+server.ts`
GET handler. Reads `?signal=&min_lift=`. Validates signal param. Queries `correlation_index` for top 25 correlates by lift. Returns `{signal, correlates, count}`.

### `src/routes/api/admin/run-correlation-discovery/+server.ts`
POST handler. Reads `{secret}`. Validates against `ADMIN_SECRET` env var (import from `$env/static/private`). Calls `runCorrelationDiscovery()` in background (fire and forget). Returns `{status: 'started'}`.

---

## Task 11 — Brand Dashboard Frontend

**File:** `src/routes/brand/+page.svelte`

Build the brand audience search UI:

1. **Query input section** — large textarea (placeholder with example prompts), submit button, character count
2. **Progress display** — live SSE progress steps: "Parsing query... → Expanding correlations... → Matching users (N found)... → Clustering... → Labeling cohorts..."
3. **Results section:**
   - Summary bar: total matched, tier breakdown (T1/T2/T3/T4/T5 counts)
   - Cohort cards grid: label (bold), description, user count badge, avg confidence bar, top 3 signals as chips
   - For T4 matches: correlation path display (e.g. "Matched via: Bieber → streetwear → your target")
   - "Expand 3x" button per cohort → calls /api/brand/expand
4. **Correlation explorer** — small section: text input for signal, shows top correlates as a simple list with lift scores

Use Wagwan's existing Tailwind classes and component patterns. Match the aesthetic of existing pages in `src/routes/`.

No PII displayed anywhere. Show only: cohort labels, counts, signals, confidence scores.

---

## Execution Notes

- All 11 tasks are sequential (each depends on previous)
- Use `getServiceSupabase()` for all DB access
- Use `claude-haiku-4-5-20251001` for fast path inferences if needed; `claude-sonnet-4-5` for NLP parsing + cohort labeling
- The `embedTexts` stub in audienceMatcher.ts means semantic search (Tier 1b, Tier 2 semantic) will be no-ops — that's fine for v1
- The SQL migration is applied via Supabase dashboard or `supabase db push` — write it to `supabase/migrations/`
- No tests required for v1, but TypeScript must compile cleanly
