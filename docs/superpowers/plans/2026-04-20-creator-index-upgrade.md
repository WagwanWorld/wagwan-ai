# Creator Index Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Creator Index page from a minimal name/tag directory into a rich creator profile showcase that surfaces the full depth of each creator's identity graph — follower count, engagement tier, signal strength, content categories, aesthetic, personality, and Instagram insights.

**Architecture:** Enrich the `/api/brand/creators` endpoint to return the full identity graph signals (already stored in Supabase). Rewrite the creator cards and featured spread to display this data in the editorial magazine aesthetic. Add expandable detail view per creator.

**Tech Stack:** SvelteKit, Supabase (existing `user_profiles` table), existing editorial CSS tokens, existing `computeGraphStrength` + `flattenIdentityGraph` utilities.

---

## File Structure

| File | Role |
|------|------|
| `src/routes/api/brand/creators/+server.ts` | **Modify.** Return enriched creator data from identity graph |
| `src/routes/brands/creators/+page.svelte` | **Modify.** Redesign cards and featured spread with rich data |

---

## Task 1: Enrich the Creators API

**Files:**
- Modify: `src/routes/api/brand/creators/+server.ts`

The endpoint currently returns: name, handle, followers, archetype, location, vibeTags, contentTags, strength, initial. It strips `googleSub`.

Enrich it to also return:

```typescript
{
  // Existing fields
  name, handle, followers, archetype, location, vibeTags, contentTags, strength, initial,
  
  // New fields from identity_graph
  strengthLabel: 'high' | 'medium' | 'low',       // from computeGraphStrength
  aesthetic: string,                                 // from graph.aesthetic
  lifestyle: string,                                 // from graph.lifestyle  
  brandVibes: string[],                              // from graph.brandVibes (up to 5)
  interests: string[],                               // from graph.interests (up to 8)
  activities: string[],                              // from graph.activities (up to 5)
  contentCategories: string[],                       // from graph.contentCategories (up to 5)
  
  // New fields from profile_data.instagramIdentity
  profilePicture: string,                            // from ig.profilePicture
  bio: string,                                       // from ig.rawSummary (truncated to 200 chars)
  mediaCount: number,                                // from ig.mediaCount
  engagementTier: 'high' | 'medium' | 'low' | '',   // from ig.engagement?.engagementTier
  captionIntent: string,                             // from ig.captionIntent
  creatorTier: string,                               // from ig.igCreatorTier
  personality: { expressive: number; humor: number; introspective: number } | null,
  
  // Visual identity
  colorPalette: string[],                            // from ig.visual?.colorPalette (up to 4)
  aestheticTone: string,                             // from ig.visual?.aesthetic?.tone
}
```

- [ ] **Step 1: Rewrite the creator mapping**

Replace the `creators` mapping in the GET handler:

```typescript
const creators = (rows ?? []).map(row => {
  const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
  const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
  const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const snapshot = graph.identitySnapshot as any;
  const strength = computeGraphStrength(graph, profileData);
  const tags = flattenIdentityGraph(graph).slice(0, 8);

  const personality = ig?.personality as { expressive: number; humor: number; introspective: number } | undefined;
  const visual = ig?.visual as Record<string, unknown> | undefined;
  const engagement = ig?.engagement as Record<string, unknown> | undefined;

  return {
    googleSub: row.google_sub as string,
    name: (row.name as string) || '',
    handle: (ig?.username as string) || '',
    followers: (ig?.followersCount as number) || 0,
    archetype: snapshot?.payload?.archetype || '',
    location: (graph.city as string) || (profileData.city as string) || '',
    vibeTags: snapshot?.payload?.vibe?.slice(0, 3) || [],
    contentTags: tags,
    strength: strength.score,
    strengthLabel: strength.label,
    initial: ((row.name as string) || '?').charAt(0).toUpperCase(),

    // Identity signals
    aesthetic: (graph.aesthetic as string) || (ig?.aesthetic as string) || '',
    lifestyle: (graph.lifestyle as string) || (ig?.lifestyle as string) || '',
    brandVibes: ((graph.brandVibes || ig?.brandVibes || []) as string[]).slice(0, 5),
    interests: ((graph.interests || ig?.interests || []) as string[]).slice(0, 8),
    activities: ((graph.activities || []) as string[]).slice(0, 5),
    contentCategories: ((graph.contentCategories || []) as string[]).slice(0, 5),

    // Instagram profile
    profilePicture: (ig?.profilePicture as string) || '',
    bio: ((ig?.rawSummary as string) || '').slice(0, 200),
    mediaCount: (ig?.mediaCount as number) || 0,
    engagementTier: (engagement?.engagementTier as string) || '',
    captionIntent: (ig?.captionIntent as string) || '',
    creatorTier: (ig?.igCreatorTier as string) || '',
    personality: personality || null,

    // Visual
    colorPalette: ((visual?.colorPalette || []) as string[]).slice(0, 4),
    aestheticTone: ((visual?.aesthetic as any)?.tone as string) || '',
  };
}).filter(c => c.name);
```

- [ ] **Step 2: Update dedup to keep enriched fields**

No change needed — the dedup already works on the full object.

- [ ] **Step 3: Update the response stripping**

Keep stripping `googleSub` but keep all new fields:

```typescript
const result = [...deduped.values()].map(({ googleSub, ...rest }) => rest);
```

This is already correct — no change needed.

- [ ] **Step 4: Verify endpoint returns enriched data**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/brand/creators/+server.ts
git commit -m "feat(brand): enrich creators API with full identity graph signals"
```

---

## Task 2: Redesign the Creator Cards

**Files:**
- Modify: `src/routes/brands/creators/+page.svelte`

Update the `Creator` type, the featured spread, and the grid cards to display the enriched data.

- [ ] **Step 1: Update the Creator type**

Replace the existing type at the top of the `<script>`:

```typescript
type Creator = {
  name: string;
  handle: string;
  followers: number;
  archetype: string;
  location: string;
  vibeTags: string[];
  contentTags: string[];
  strength: number;
  strengthLabel: string;
  initial: string;
  aesthetic: string;
  lifestyle: string;
  brandVibes: string[];
  interests: string[];
  activities: string[];
  contentCategories: string[];
  profilePicture: string;
  bio: string;
  mediaCount: number;
  engagementTier: string;
  captionIntent: string;
  creatorTier: string;
  personality: { expressive: number; humor: number; introspective: number } | null;
  colorPalette: string[];
  aestheticTone: string;
};
```

- [ ] **Step 2: Add expand/collapse state**

```typescript
let expandedCreator: string | null = null; // track by name+handle

function toggleExpand(creator: Creator) {
  const key = `${creator.name}::${creator.handle}`;
  expandedCreator = expandedCreator === key ? null : key;
}

function isExpanded(creator: Creator): boolean {
  return expandedCreator === `${creator.name}::${creator.handle}`;
}
```

- [ ] **Step 3: Redesign the featured spread**

Replace the featured spread section with:

```svelte
{#if featured}
  <section class="featured-spread">
    <div class="featured-portrait">
      {#if featured.profilePicture}
        <img src={featured.profilePicture} alt={featured.name} class="portrait-img" />
      {:else}
        <div class="portrait-frame" style="background: {avatarGradient(featured.name)}">
          <span class="portrait-initial">{featured.initial}</span>
        </div>
      {/if}
    </div>
    <div class="featured-content">
      <span class="ed-kicker">Featured Creator</span>
      <h2 class="featured-name">{featured.name}</h2>
      <div class="featured-byline">
        {#if featured.handle}<span class="byline-handle">@{featured.handle}</span>{/if}
        {#if featured.location}<span class="byline-location">{featured.location}</span>{/if}
        {#if featured.creatorTier}<span class="byline-tier">{featured.creatorTier}</span>{/if}
      </div>
      
      {#if featured.bio}
        <p class="featured-bio">{featured.bio}</p>
      {:else if featured.archetype}
        <blockquote class="featured-quote">&ldquo;{featured.archetype}&rdquo;</blockquote>
      {/if}

      <div class="featured-facts">
        <div class="fact">
          <span class="fact-number">{formatFollowersRaw(featured.followers)}</span>
          <span class="ed-stat-label">Followers</span>
        </div>
        <div class="fact">
          <span class="fact-number">{featured.mediaCount.toLocaleString()}</span>
          <span class="ed-stat-label">Posts</span>
        </div>
        <div class="fact">
          <span class="fact-number">{Math.round(featured.strength)}</span>
          <span class="ed-stat-label">Signal Strength</span>
        </div>
        {#if featured.engagementTier}
          <div class="fact">
            <span class="fact-number fact-tier" data-tier={featured.engagementTier}>{featured.engagementTier}</span>
            <span class="ed-stat-label">Engagement</span>
          </div>
        {/if}
      </div>

      <!-- Signal strength bar -->
      <div class="strength-meter">
        <div class="strength-track">
          <div class="strength-fill" style="width: {featured.strength}%"></div>
        </div>
        <span class="strength-label">{featured.strengthLabel} signal</span>
      </div>

      <!-- Categories + interests -->
      <div class="featured-tags">
        {#if featured.aesthetic}
          <span class="ftag ftag--accent">{featured.aesthetic}</span>
        {/if}
        {#if featured.lifestyle}
          <span class="ftag ftag--accent">{featured.lifestyle}</span>
        {/if}
        {#each featured.interests.slice(0, 5) as interest}
          <span class="ftag">{interest}</span>
        {/each}
      </div>

      <!-- Color palette dots -->
      {#if featured.colorPalette.length > 0}
        <div class="palette-row">
          <span class="ed-stat-label">Visual Palette</span>
          <div class="palette-dots">
            {#each featured.colorPalette as color}
              <span class="palette-dot" style="background: {color}"></span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>
{/if}
```

- [ ] **Step 4: Redesign the grid cards**

Replace the creator card in the `{#each rest}` loop:

```svelte
<article class="creator-card {gridClass(i)}" style="--i:{i}" on:click={() => toggleExpand(creator)}>
  <!-- Avatar / Photo -->
  <div class="card-portrait">
    {#if creator.profilePicture}
      <img src={creator.profilePicture} alt={creator.name} class="card-photo" />
    {:else}
      <div class="card-avatar" style="background: {avatarGradient(creator.name)}">
        <span class="card-initial">{creator.initial}</span>
      </div>
    {/if}
  </div>

  <div class="card-body">
    <h3 class="card-name">{creator.name}</h3>
    <span class="card-handle">
      {#if creator.handle}@{creator.handle}{/if}
      {#if creator.handle && creator.location} &middot; {/if}
      {#if creator.location}{creator.location}{/if}
    </span>

    <!-- Stats row: followers, posts, strength -->
    <div class="card-stats-row">
      <div class="card-stat">
        <span class="card-stat-num">{formatFollowers(creator.followers)}</span>
        <span class="card-stat-label">Followers</span>
      </div>
      <div class="card-stat">
        <span class="card-stat-num">{creator.mediaCount.toLocaleString()}</span>
        <span class="card-stat-label">Posts</span>
      </div>
      <div class="card-stat">
        <span class="card-stat-num">{Math.round(creator.strength)}</span>
        <span class="card-stat-label">Signal</span>
      </div>
    </div>

    <!-- Signal strength bar -->
    <div class="card-strength">
      <div class="card-strength-track">
        <div class="card-strength-fill" style="width: {creator.strength}%"></div>
      </div>
      <span class="card-strength-label">{creator.strengthLabel}</span>
    </div>

    <!-- Engagement + aesthetic badges -->
    <div class="card-badges">
      {#if creator.engagementTier}
        <span class="card-badge" data-tier={creator.engagementTier}>{creator.engagementTier} engagement</span>
      {/if}
      {#if creator.aesthetic}
        <span class="card-badge">{creator.aesthetic}</span>
      {/if}
      {#if creator.captionIntent}
        <span class="card-badge">{creator.captionIntent}</span>
      {/if}
    </div>

    <!-- Top categories -->
    <div class="card-tags">
      {#each [...creator.contentCategories, ...creator.interests].slice(0, 4) as tag}
        <span class="ctag">{tag}</span>
      {/each}
    </div>

    <!-- Expanded detail -->
    {#if isExpanded(creator)}
      <div class="card-detail">
        {#if creator.bio}
          <p class="detail-bio">{creator.bio}</p>
        {/if}
        
        {#if creator.brandVibes.length > 0}
          <div class="detail-section">
            <span class="detail-label">Brand Vibes</span>
            <div class="detail-tags">
              {#each creator.brandVibes as vibe}
                <span class="detail-tag">{vibe}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if creator.interests.length > 0}
          <div class="detail-section">
            <span class="detail-label">Interests</span>
            <div class="detail-tags">
              {#each creator.interests as interest}
                <span class="detail-tag">{interest}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if creator.personality}
          <div class="detail-section">
            <span class="detail-label">Personality</span>
            <div class="personality-bars">
              <div class="pbar">
                <span class="pbar-label">Expressive</span>
                <div class="pbar-track"><div class="pbar-fill" style="width: {creator.personality.expressive * 100}%"></div></div>
              </div>
              <div class="pbar">
                <span class="pbar-label">Humor</span>
                <div class="pbar-track"><div class="pbar-fill" style="width: {creator.personality.humor * 100}%"></div></div>
              </div>
              <div class="pbar">
                <span class="pbar-label">Introspective</span>
                <div class="pbar-track"><div class="pbar-fill" style="width: {creator.personality.introspective * 100}%"></div></div>
              </div>
            </div>
          </div>
        {/if}

        {#if creator.colorPalette.length > 0}
          <div class="detail-section">
            <span class="detail-label">Visual Palette</span>
            <div class="palette-dots">
              {#each creator.colorPalette as color}
                <span class="palette-dot" style="background: {color}"></span>
              {/each}
            </div>
          </div>
        {/if}

        {#if creator.archetype}
          <p class="detail-archetype">&ldquo;{creator.archetype}&rdquo;</p>
        {/if}
      </div>
    {/if}
  </div>
</article>
```

- [ ] **Step 5: Add new styles**

Add to the `<style>` block:

```css
/* Portrait photo */
.card-photo, .portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Stats row */
.card-stats-row {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--ed-rule);
  border-bottom: 1px solid var(--ed-rule);
  padding: 8px 0;
  margin: 8px 0 6px;
}
.card-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  border-right: 1px solid var(--ed-rule);
}
.card-stat:last-child { border-right: none; }
.card-stat-num {
  font-family: var(--ed-font-display);
  font-size: 1.125rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ed-ink);
}
.card-stat-label {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ed-ink-ghost);
}

/* Signal strength bar */
.card-strength, .strength-meter {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-strength-track, .strength-track {
  flex: 1;
  height: 3px;
  background: var(--ed-rule);
  overflow: hidden;
}
.card-strength-fill, .strength-fill {
  height: 100%;
  background: var(--ed-accent);
  transition: width 0.6s var(--ed-ease);
}
.card-strength-label, .strength-label {
  font-family: var(--ed-font-mono);
  font-size: 9px;
  font-weight: 600;
  color: var(--ed-ink-ghost);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

/* Badges */
.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}
.card-badge {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 8px;
  border: 1px solid var(--ed-rule);
  color: var(--ed-ink-3);
}
.card-badge[data-tier="high"] {
  border-color: #059669;
  color: #059669;
}
.card-badge[data-tier="low"] {
  border-color: var(--ed-ink-ghost);
  color: var(--ed-ink-ghost);
}

/* Featured spread additions */
.featured-bio {
  font-size: var(--ed-text-sm);
  color: var(--ed-ink-3);
  line-height: 1.5;
  margin: 0;
}
.fact-tier { text-transform: uppercase; font-size: 1rem !important; }
.fact-tier[data-tier="high"] { color: #059669; }
.fact-tier[data-tier="medium"] { color: var(--ed-ink-3); }
.ftag--accent {
  border-color: var(--ed-accent);
  color: var(--ed-accent);
}
.palette-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.palette-dots {
  display: flex;
  gap: 4px;
}
.palette-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--ed-rule);
}

/* Expanded detail */
.card-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ed-rule-light);
  margin-top: 8px;
}
.detail-bio {
  font-size: var(--ed-text-xs);
  color: var(--ed-ink-3);
  line-height: 1.5;
  margin: 0;
}
.detail-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-label {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ed-ink-ghost);
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.detail-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border: 1px solid var(--ed-rule);
  color: var(--ed-ink-3);
}
.detail-archetype {
  font-family: var(--ed-font-display);
  font-style: italic;
  font-size: var(--ed-text-sm);
  color: var(--ed-ink-3);
  margin: 0;
}

/* Personality bars */
.personality-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pbar {
  display: grid;
  grid-template-columns: 80px 1fr;
  align-items: center;
  gap: 8px;
}
.pbar-label {
  font-family: var(--ed-font-mono);
  font-size: 9px;
  color: var(--ed-ink-ghost);
}
.pbar-track {
  height: 3px;
  background: var(--ed-rule);
  overflow: hidden;
}
.pbar-fill {
  height: 100%;
  background: var(--ed-accent);
  transition: width 0.5s var(--ed-ease);
}

/* Make cards clickable */
.creator-card { cursor: pointer; }
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/brands/creators/+page.svelte
git commit -m "feat(brand): redesign creator cards with full identity graph data"
```

---

## Task 3: Deploy and Verify

- [ ] **Step 1: Type check**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run check 2>&1 | grep -i error | grep -v 'Unused CSS' | grep -v 'css_unused_selector'
```

- [ ] **Step 2: Deploy**

```bash
vercel --prod --force
```

- [ ] **Step 3: Alias**

```bash
vercel alias <deployment-url> wagwanworld.vercel.app
```

- [ ] **Step 4: Verify**

Visit https://wagwanworld.vercel.app/brands/creators and confirm:
- Featured creator shows profile picture, followers, posts, signal strength bar, engagement tier, interests, color palette
- Grid cards show stats row (followers/posts/signal), strength bar, badges (engagement tier, aesthetic, caption intent), top categories
- Clicking a card expands to show full detail: bio, brand vibes, all interests, personality bars, color palette, archetype
