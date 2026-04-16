# Identity Engine Phase 1: Signal Scoring Fixes + Conflict Resolution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 critical scoring bugs in signalMeter.ts, add conflict detection to behavioralPrecalc.ts, add signal hash gate to skip redundant inference runs, and wire expression feedback votes into the pipeline.

**Architecture:** All changes touch existing files only — no new DB tables, no new files. The signal meter gets platform-stratified weights, genre deduplication, evidence gating, and Apple Music intent tiers. The behavioral precalc gets contradiction detection. The refresh pipeline gets a signal hash gate to skip inference when nothing changed.

**Tech Stack:** TypeScript, SvelteKit server-side modules, Supabase (read-only for existing tables)

**Source Spec:** `/Users/madhviknemani/Downloads/wagwan_identity_engine_spec.docx` — Sections 3.1–3.7, 7.2, 10.3

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/server/signalMeter.ts` | Modify | Platform-stratified scoreBase, genre cluster collapse, evidence gate, Apple Music tiers, playlist context signals, caption mention signals |
| `src/lib/server/behavioralPrecalc.ts` | Modify | Conflict detection in deriveNegativeSignals, signal_relations block, deterministic momentum |
| `src/lib/server/marketplace/inferIdentityGraph.ts` | Modify | Accept signal_relations in bundle |
| `src/routes/api/refresh-signals/+server.ts` | Modify | Signal hash gate to skip inference |
| `src/lib/server/expression/buildExpressionLayer.ts` | Modify | Read and apply expressionFeedback.votes |

---

### Task 1: Platform-Stratified scoreBase()

**Files:**
- Modify: `src/lib/server/signalMeter.ts` (lines 150–162)

**Spec ref:** Section 3.1

- [ ] **Step 1: Replace scoreBase() with platform-aware weights**

Replace the existing `scoreBase()` function (L150–162) with:

```typescript
/** Platform-stratified weights — each platform's data has different signal characteristics */
const PLATFORM_WEIGHTS: Record<string, { s: number; r: number; f: number; c: number }> = {
  manual:    { s: 0.50, r: 0.10, f: 0.10, c: 0.30 }, // user-set = trust confidence most
  instagram: { s: 0.45, r: 0.25, f: 0.15, c: 0.15 }, // behavioral + aesthetic
  linkedin:  { s: 0.35, r: 0.15, f: 0.10, c: 0.40 }, // professional = trust confidence
  music:     { s: 0.30, r: 0.35, f: 0.30, c: 0.05 }, // taste = recency + frequency
  google:    { s: 0.35, r: 0.40, f: 0.20, c: 0.05 }, // calendar = recency dominant
  youtube:   { s: 0.40, r: 0.25, f: 0.25, c: 0.10 }, // content = balanced
};

function scoreBase(signal: {
  strength: number;
  recency: number;
  frequency: number;
  confidence: number;
  platform_bucket?: string;
}): number {
  const w = PLATFORM_WEIGHTS[signal.platform_bucket ?? 'instagram'] ?? PLATFORM_WEIGHTS.instagram;
  return clamp01(
    w.s * signal.strength +
    w.r * signal.recency +
    w.f * signal.frequency +
    w.c * signal.confidence,
  );
}
```

- [ ] **Step 2: Update mergeCandidates() to pass platform_bucket to scoreBase**

In `mergeCandidates()`, find the line that calls `scoreBase(row)` (around L310) and change it to:

```typescript
const base_score = clamp01(scoreBase({ ...row, platform_bucket: primaryBucket(row.platform_buckets) }) + boost);
```

This ensures `scoreBase` receives the platform bucket from the merged signal.

- [ ] **Step 3: Verify the dev server starts without errors**

Run: `npm run dev` — check for TypeScript/compile errors in terminal output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/signalMeter.ts
git commit -m "fix: platform-stratified signal scoring weights"
```

---

### Task 2: Collapse Music Genre Cluster

**Files:**
- Modify: `src/lib/server/signalMeter.ts`

**Spec ref:** Section 3.2

- [ ] **Step 1: Add collapseGenreCluster() function**

Add this function above `mergeCandidates()`:

```typescript
/**
 * Apple Music/Spotify genres that share ~85% behavioral variance should not
 * be counted as independent signals. Collapse top genres into a single cluster.
 */
function collapseGenreCluster(candidates: SignalCandidate[]): SignalCandidate[] {
  const genres = candidates.filter(s => s.category === 'music_genre' || s.category === 'genre');
  if (genres.length <= 2) return candidates;

  const sorted = [...genres].sort((a, b) => b.strength - a.strength);
  const cluster: SignalCandidate = {
    value: sorted.slice(0, 3).map(s => s.value).join(' / '),
    category: 'music_genre_cluster',
    type: sorted[0].type,
    strength: Math.max(...sorted.map(s => s.strength)),
    frequency: sorted.reduce((a, s) => a + s.frequency, 0) / sorted.length,
    confidence: sorted[0].confidence,
    recency: Math.max(...sorted.map(s => s.recency)),
    source: 'music_cluster',
    platform_buckets: [...new Set(sorted.flatMap(s => s.platform_buckets))],
    direction: 'positive',
    context: `Collapsed genre cluster — top genres by play frequency: ${sorted.slice(0, 3).map(s => s.value).join(', ')}`,
  };

  const nonGenre = candidates.filter(s => s.category !== 'music_genre' && s.category !== 'genre');
  return [...nonGenre, cluster];
}
```

- [ ] **Step 2: Call collapseGenreCluster before mergeCandidates in buildSignalMeter**

In `buildSignalMeter()`, find where `mergeCandidates(candidates)` is called (around L650) and change:

```typescript
// Before:
const { merged, noise } = mergeCandidates(candidates);

// After:
const collapsedCandidates = collapseGenreCluster(candidates);
const { merged, noise } = mergeCandidates(collapsedCandidates);
```

- [ ] **Step 3: Verify genre category names match**

Search signalMeter.ts for where genre signals are added as candidates. The category string used when adding genre signals must match `'music_genre'` or `'genre'` — check the `addCandidate()` calls in the Spotify/Apple Music blocks. If the category is something like `'top_genre'`, update the filter in `collapseGenreCluster()` to match.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/signalMeter.ts
git commit -m "fix: collapse music genre cluster to prevent 4x inflation"
```

---

### Task 3: Evidence Count Gate

**Files:**
- Modify: `src/lib/server/signalMeter.ts`

**Spec ref:** Section 3.3

- [ ] **Step 1: Add evidenceGate() and platform signal counter**

Add this function near `scoreBase()`:

```typescript
/**
 * Sparse platforms (LinkedIn with 4 signals) should not receive the same
 * confidence treatment as rich platforms (Instagram with 174 posts).
 * Returns 0–1 multiplier based on exponential saturation curve.
 */
function evidenceGate(nSignals: number, platform: string): number {
  const k: Record<string, number> = { linkedin: 8, google: 12, instagram: 20, music: 5, manual: 3, youtube: 10 };
  const kVal = k[platform] ?? 10;
  return 1 - Math.exp(-nSignals / kVal);
}
```

- [ ] **Step 2: Count signals per platform bucket in mergeCandidates**

In `mergeCandidates()`, before the final scoring loop, add a platform signal count:

```typescript
// Count signals per platform bucket for evidence gating
const platformSignalCounts: Record<string, number> = {};
for (const row of map.values()) {
  const bucket = primaryBucket(row.platform_buckets);
  platformSignalCounts[bucket] = (platformSignalCounts[bucket] ?? 0) + 1;
}
```

- [ ] **Step 3: Apply evidence gate to final_score**

In the scoring loop inside `mergeCandidates()`, after computing `base_score`, apply the gate:

```typescript
const boost = crossPlatformBoost(row.platform_buckets.length);
const rawScore = clamp01(scoreBase({ ...row, platform_bucket: primaryBucket(row.platform_buckets) }) + boost);
const bucket = primaryBucket(row.platform_buckets);
const gate = evidenceGate(platformSignalCounts[bucket] ?? 10, bucket);
const base_score = clamp01(rawScore * gate);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/signalMeter.ts
git commit -m "fix: add evidence count gate for sparse platforms"
```

---

### Task 4: Apple Music Intent Tiers

**Files:**
- Modify: `src/lib/server/signalMeter.ts`

**Spec ref:** Section 3.5

- [ ] **Step 1: Add APPLE_MUSIC_TIERS constant**

Add near the top of the file, after PLATFORM_WEIGHTS:

```typescript
/** Apple Music signal sources have different intent levels */
const APPLE_MUSIC_TIERS: Record<string, { strength: number; confidence: number }> = {
  lovedSongs:       { strength: 0.92, confidence: 0.90 }, // explicit preference
  heavyRotation:    { strength: 0.75, confidence: 0.70 }, // behavioral, high frequency
  recentlyPlayed:   { strength: 0.55, confidence: 0.50 }, // recency only
  libraryArtists:   { strength: 0.45, confidence: 0.40 }, // broad, low intent
  recommendedNames: { strength: 0.30, confidence: 0.25 }, // Apple's inference, not user's
};
```

- [ ] **Step 2: Apply tiers in Apple Music signal ingestion**

Find the Apple Music signal ingestion block in `buildSignalMeter()` (where `am.topArtists`, `am.topGenres`, etc. are added as candidates). For each `addCandidate()` call that uses Apple Music data, apply the appropriate tier override.

For example, if there's a block like:
```typescript
if (am?.topArtists) {
  for (const artist of am.topArtists.slice(0, 6)) {
    addCandidate({ ..., strength: 0.80, confidence: 0.70, ... });
  }
}
```

Add tier-aware overrides based on the source field. For `recentlyPlayed`:
```typescript
if (am?.recentlyPlayed) {
  const tier = APPLE_MUSIC_TIERS.recentlyPlayed;
  for (const track of am.recentlyPlayed.slice(0, 6)) {
    const name = typeof track === 'string' ? track : (track as { title?: string })?.title ?? '';
    if (!name) continue;
    addCandidate({ value: name, category: 'recent_track', type: 'taste',
      strength: tier.strength, confidence: tier.confidence, recency: amRecency, frequency: 0.6,
      source: 'apple_music', platform_buckets: ['music'], direction: 'positive',
      context: 'Recently played track — recency signal, not preference' });
  }
}
```

Apply similar tier overrides for `heavyRotationTracks` (use `APPLE_MUSIC_TIERS.heavyRotation`), `libraryArtists` (use `APPLE_MUSIC_TIERS.libraryArtists`), and `recommendedNames` (use `APPLE_MUSIC_TIERS.recommendedNames`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/signalMeter.ts
git commit -m "fix: apply intent-tier overrides for Apple Music signals"
```

---

### Task 5: Playlist Name Context Extractor

**Files:**
- Modify: `src/lib/server/signalMeter.ts`

**Spec ref:** Section 3.6

- [ ] **Step 1: Add playlistNameToContextSignals() function**

Add this function in signalMeter.ts:

```typescript
/**
 * Apple Music playlist names contain rich contextual signals.
 * 'Goa', 'Airport', 'At home party' each map to lifestyle contexts.
 */
function playlistNameToContextSignals(playlistNames: string[], recency: number): SignalCandidate[] {
  const CONTEXT_MAP: Record<string, { context: string; lifestyle: string }> = {
    'goa|trip|travel|roadtrip|drive': { context: 'travel', lifestyle: 'frequent traveler' },
    'airport|flight|transit':         { context: 'travel', lifestyle: 'frequent traveler' },
    'party|pregame|night out':        { context: 'social', lifestyle: 'active social life' },
    'home|chill|relax|sunday':        { context: 'domestic', lifestyle: 'home-focused' },
    'gym|workout|run|lift':           { context: 'fitness', lifestyle: 'fitness active' },
    'focus|study|work|deep':          { context: 'productivity', lifestyle: 'focus worker' },
    'cook|kitchen|dinner':            { context: 'food', lifestyle: 'home cook' },
  };
  const signals: SignalCandidate[] = [];
  for (const name of playlistNames) {
    const lower = name.toLowerCase();
    for (const [pattern, meta] of Object.entries(CONTEXT_MAP)) {
      if (pattern.split('|').some(p => lower.includes(p))) {
        signals.push({
          value: meta.lifestyle, category: 'playlist_context', type: 'behavior',
          strength: 0.72, confidence: 0.78, recency, frequency: 0.6,
          source: 'apple_music', platform_buckets: ['music'],
          direction: 'positive',
          context: `Inferred from playlist name: '${name}'`,
        });
        break;
      }
    }
  }
  return signals;
}
```

- [ ] **Step 2: Call it in buildSignalMeter() Apple Music block**

In the Apple Music section of `buildSignalMeter()`, after processing existing Apple Music signals, add:

```typescript
// Playlist name context signals
const playlistNames = [
  ...((am?.rotationPlaylists ?? []) as string[]),
  ...((am?.libraryPlaylists ?? []) as string[]),
];
if (playlistNames.length > 0) {
  const contextSignals = playlistNameToContextSignals(playlistNames, amRecency);
  candidates.push(...contextSignals);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/signalMeter.ts
git commit -m "feat: extract lifestyle signals from Apple Music playlist names"
```

---

### Task 6: Caption Mentions as Intent Signals

**Files:**
- Modify: `src/lib/server/signalMeter.ts`

**Spec ref:** Section 4.2

- [ ] **Step 1: Add captionMentionsToSignals() function**

```typescript
/**
 * Instagram caption mentions are explicit public associations — high-intent identity signals.
 * confidence=0.95 because the user deliberately typed these in public captions.
 */
function captionMentionsToSignals(mentions: string[], recency: number): SignalCandidate[] {
  return mentions.filter(Boolean).map(mention => ({
    value: mention,
    category: 'caption_mention',
    type: 'intent' as const,
    strength: 0.85,
    confidence: 0.95,
    frequency: 0.5,
    recency,
    source: 'instagram',
    platform_buckets: ['instagram'] as PlatformBucket[],
    direction: 'positive' as const,
    context: 'User explicitly mentions in public Instagram captions',
  }));
}
```

- [ ] **Step 2: Call it in buildSignalMeter() Instagram block**

In the Instagram signal ingestion block, after existing caption processing, add:

```typescript
// Caption mentions as intent signals
if (ig?.captionMentions?.length) {
  candidates.push(...captionMentionsToSignals(ig.captionMentions.slice(0, 15), igRecency));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/signalMeter.ts
git commit -m "feat: convert Instagram caption mentions to high-intent signals"
```

---

### Task 7: Conflict Detection in behavioralPrecalc

**Files:**
- Modify: `src/lib/server/behavioralPrecalc.ts`

**Spec ref:** Section 3.4

- [ ] **Step 1: Add conflict detection to deriveNegativeSignals()**

In `deriveNegativeSignals()` (around L241), add these conflict patterns after the existing 4 patterns:

```typescript
// Founder/job-seeker conflict
const hasFounderBio = (graph.bioRoles ?? []).some(r => /founder|ceo|co-founder/i.test(r));
const hasJobSeeker = (graph.linkedinIntentTokens ?? []).some((t: string) => t.includes('job_seeker')) ||
  ((mergedProfile.linkedinIdentity as { jobInterests?: string[] } | undefined)?.jobInterests?.length ?? 0) > 0;
if (hasFounderBio && hasJobSeeker) {
  negatives.push({
    pattern: 'founder_jobseeker_conflict',
    implication: 'Instagram bio states founder role. LinkedIn job_seeker is inferred from incomplete profile. Treat Instagram bio as ground truth. Do NOT infer career-pivot intent.',
    dampens: ['growth'],
  });
}

// Creator tier vs consumption pattern conflict
const isCreator = graph.igCreatorTier === 'micro' || (graph.followersCount ?? 0) > 5000;
const isHeavyConsumer = (graph.topChannels?.length ?? 0) >= 8;
if (isCreator && isHeavyConsumer) {
  negatives.push({
    pattern: 'creator_consumer_conflict',
    implication: 'User has creator-level audience but also consumes heavily. Likely a creator who studies competitors, not a passive consumer. Weight creator signals higher.',
    dampens: ['consumer_score'],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/behavioralPrecalc.ts
git commit -m "feat: add founder/jobseeker and creator/consumer conflict detection"
```

---

### Task 8: Signal Relations Block in Inference Bundle

**Files:**
- Modify: `src/lib/server/marketplace/inferIdentityGraph.ts`

**Spec ref:** Section 3.4 (second part)

- [ ] **Step 1: Add signal_relations to the bundle object in buildInferenceSignalBundle()**

Find where the bundle object is constructed (the large object literal that gets `JSON.stringify`'d). Add a new field:

```typescript
signal_relations: behavioralPrecalc ? {
  corroborations: behavioralPrecalc.cross_platform_themes
    .filter(t => t.tier >= 2)
    .slice(0, 8)
    .map(t => ({ theme: t.label, platforms: t.platforms, strength: t.tier >= 3 ? 'high' : 'medium' })),
  contradictions: behavioralPrecalc.negative_signals
    .filter(n => n.pattern.includes('conflict'))
    .map(n => ({ pattern: n.pattern, resolution: n.implication })),
} : null,
```

- [ ] **Step 2: Add instruction to the system prompt about signal_relations**

In the `SYSTEM_PROMPT` constant, add to the `BEHAVIORAL_PRECALC` section:

```
When signal_relations is present:
- corroborations: these themes are confirmed across multiple platforms — treat as high-confidence anchors
- contradictions: these are conflicting signals — follow the resolution guidance provided, do not infer both sides
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/marketplace/inferIdentityGraph.ts
git commit -m "feat: pass signal relations (corroborations + contradictions) to inference"
```

---

### Task 9: Deterministic Momentum Score

**Files:**
- Modify: `src/lib/server/behavioralPrecalc.ts`

**Spec ref:** Section 10.3

- [ ] **Step 1: Add momentum_score and momentum_delta to BehavioralPrecalcResult**

Update the interface:

```typescript
export interface BehavioralPrecalcResult {
  primary_intent_type: IntentType;
  intent_scores: Record<IntentType, number>;
  cross_platform_themes: CrossPlatformTheme[];
  negative_signals: NegativeSignalItem[];
  platform_connected: Record<string, boolean>;
  intent_weight_matrix_applied: string;
  momentum_score: number;   // 0–100, deterministic from signal deltas
  momentum_delta: number;   // change from prior run
}
```

- [ ] **Step 2: Add computeDeterministicMomentum() function**

```typescript
function computeDeterministicMomentum(
  currentMeter: SignalMeterOutput,
  priorMomentum: number | null,
): { score: number; delta: number } {
  if (!priorMomentum && priorMomentum !== 0) return { score: 50, delta: 0 };

  // Compute average signal strength as a proxy for identity richness
  const avgStrength = currentMeter.signals.length > 0
    ? currentMeter.signals.reduce((a, s) => a + s.final_score, 0) / currentMeter.signals.length
    : 0;

  // Momentum = weighted combination of signal count growth and average strength
  const signalCountFactor = Math.min(currentMeter.signals.length / 30, 1.0); // saturates at 30 signals
  const newScore = Math.max(0, Math.min(100, Math.round(avgStrength * 60 + signalCountFactor * 40)));
  const delta = newScore - (priorMomentum ?? 50);

  return { score: newScore, delta };
}
```

- [ ] **Step 3: Call it in buildBehavioralPrecalc()**

At the end of `buildBehavioralPrecalc()`, before the return statement, compute momentum:

```typescript
// Deterministic momentum — not LLM-estimated
const priorMomentum = (mergedProfile.lastMomentumScore as number | undefined) ?? null;
const { score: momentum_score, delta: momentum_delta } = computeDeterministicMomentum(signalMeter, priorMomentum);
```

Update the return to include:
```typescript
return {
  primary_intent_type,
  intent_scores,
  cross_platform_themes,
  negative_signals,
  platform_connected,
  intent_weight_matrix_applied,
  momentum_score,
  momentum_delta,
};
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/behavioralPrecalc.ts
git commit -m "fix: compute momentum_score deterministically instead of LLM-estimated"
```

---

### Task 10: Signal Hash Gate — Skip Inference When Nothing Changed

**Files:**
- Modify: `src/routes/api/refresh-signals/+server.ts`

**Spec ref:** Section 3.7

- [ ] **Step 1: Add computeSignalHash() function**

At the top of the file (after imports), add:

```typescript
import { createHash } from 'crypto';

function computeSignalHash(signals: Array<{ value: string; final_score: number }>): string {
  const key = signals
    .sort((a, b) => a.value.localeCompare(b.value))
    .map(s => `${s.value}:${s.final_score.toFixed(3)}`)
    .join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}
```

- [ ] **Step 2: Apply hash check before inference**

In `runRefreshPipeline()`, after `buildSignalMeter()` is called but before inference layers run, add:

```typescript
const newSignalHash = computeSignalHash(signalMeter.signals);
const priorHash = (profileData.lastSignalHash as string) ?? '';
const hashUnchanged = newSignalHash === priorHash && priorHash !== '';

// Override shouldInfer if signals haven't changed
if (hashUnchanged && !forceInference) {
  send('Signals unchanged — skipping inference (cached)');
  // Still update the profile with the new hash
  await upsertProfile(googleSub, { ...merged, lastSignalHash: newSignalHash });
} else {
  // ... existing inference code runs here
}
```

Note: You'll need to wrap the existing inference block in the else clause, or add `&& !hashUnchanged` to the existing `shouldInfer` condition.

- [ ] **Step 3: Save the hash after inference runs**

After upsertProfile at the end of the pipeline, ensure the hash is saved:

```typescript
merged.lastSignalHash = newSignalHash;
// This is already saved via the existing upsertProfile call
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/refresh-signals/+server.ts
git commit -m "feat: signal hash gate — skip inference when signals unchanged"
```

---

### Task 11: Expression Feedback Votes Integration

**Files:**
- Modify: `src/lib/server/expression/buildExpressionLayer.ts`

**Spec ref:** Section 7.2

- [ ] **Step 1: Read and apply expressionFeedback.votes**

In `buildExpressionLayer()`, after atoms are generated, add vote application logic. Find where the expression atoms array is finalized and add:

```typescript
// Apply user votes to atom scores — this is ground truth
const votes = (feedback?.votes ?? []) as Array<{ atomLabel: string; positive: boolean; category?: string }>;
const adjustedAtoms = atoms.map(atom => {
  const vote = votes.find(v => v.atomLabel?.toLowerCase() === atom.label?.toLowerCase());
  if (!vote) return atom;
  return {
    ...atom,
    strength: clamp01((atom.strength ?? 0.5) * (vote.positive ? 1.25 : 0.40)),
    userConfirmed: vote.positive,
    userRejected: !vote.positive,
  };
});
```

Replace `atoms` with `adjustedAtoms` in the return value.

Note: `feedback` is already passed as a parameter (as `ExpressionFeedbackState`). If the `clamp01` utility doesn't exist in this file, add: `const clamp01 = (n: number) => Math.max(0, Math.min(1, n));`

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/expression/buildExpressionLayer.ts
git commit -m "feat: apply expression feedback votes to atom strength scores"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

Verify no compilation errors.

- [ ] **Step 2: Test refresh-signals endpoint**

```bash
curl -s -X POST http://localhost:5173/api/refresh-signals \
  -H 'Content-Type: application/json' \
  -d '{"googleSub":"test_phase1"}' | head -20
```

Verify it returns SSE stream with step progress messages and completes without errors.

- [ ] **Step 3: Deploy to production**

```bash
vercel --prod
vercel alias <deployment-url> wagwanworld.vercel.app
```

- [ ] **Step 4: Final commit with all files**

```bash
git add -A
git commit -m "feat: identity engine phase 1 — signal scoring fixes and conflict resolution"
```
