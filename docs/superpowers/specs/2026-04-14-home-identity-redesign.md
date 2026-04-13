# Home Identity Column Redesign

**Date:** 2026-04-14
**Goal:** Transform the home page identity column from a clinical dashboard into a narrative mirror — fun, visual, spacious, with graphs, emojis, horizontal scrolls, and editorial tone.

## Scope

Only the center identity column of `/home`. Nav column (left) and chat column (right) stay unchanged. All data loading logic stays unchanged. PersonaBg ambient mesh stays.

## Section Architecture

### 1. Enhanced Hero (modify HeroIdentity.svelte)
- Profile photo with gradient ring (red/blue/gold)
- One-liner in Bodoni Moda italic (only place for display font)
- `core_contradiction` from identitySnapshot as warm reframe text below
- Archetype as a readable sentence, not uppercase label
- Emoji-prefixed vibe pills
- City + date line

### 2. How You Listen — horizontal scroll strip
- Card 1: **Artist Strip** — circular artist images from music identity (top 5-6 artists)
- Card 2: **Your Sound** — SVG donut chart showing genre distribution with red/blue/gold segments + caption
- Card 3: **When You Listen** — SVG mini heatmap (7 cols for days, 4 rows for time blocks) + caption
- Card 4: **The Narrative** — music domain narrative text in glass card

Data sources: `inferenceIdentity.life_domains['music']`, `identityMusicContext`, `identityGraph.topArtists`, `identityGraph.topGenres`, `identityGraph.temporalPattern`

### 3. How You Show Up — horizontal scroll strip  
- Card 1: **Your Aesthetic** — aesthetic description + visual tags
- Card 2: **What You Post** — SVG horizontal bar chart (content categories with emoji labels)
- Card 3: **Your Reach** — engagement/follower stats as friendly text
- Card 4: **The Narrative** — social_creator domain narrative

Data sources: `inferenceIdentity.life_domains['social_creator']`, `identityGraph` (igCreatorTier, engagementTier, igPostingCadence, aesthetic, contentCategories)

### 4. Where You're Headed — vertical stack (climax section)
- Trajectory one-liner (bold)
- Three SVG score rings side by side: Builder / Creator / Cultural scores
- 2-3 prediction cards (emoji + sentence)
- Non-obvious insight highlight card with accent

Data sources: `inferenceIdentity.current.predictions`, `inferenceIdentity.current.trajectory`, `derived_signals` (builder_score, creator_score), `hyperInference.non_obvious_insights`

### 5. For You — existing ForYouTabs (unchanged)

### 6. Signal Footer — streamlined horizontal scroll of signal chips + pattern pills

## New Components

| Component | File | Purpose |
|-----------|------|---------|
| NarrativeSection | `src/lib/components/home/NarrativeSection.svelte` | Section wrapper: emoji + label + horizontal scroll container |
| ArtistStrip | `src/lib/components/home/ArtistStrip.svelte` | Circular artist images, horizontal scroll |
| MiniDonut | `src/lib/components/home/MiniDonut.svelte` | SVG donut chart (genre breakdown) |
| MiniHeatmap | `src/lib/components/home/MiniHeatmap.svelte` | SVG 7x4 heatmap (listening times) |
| MiniBarChart | `src/lib/components/home/MiniBarChart.svelte` | SVG horizontal bars with labels |
| ScoreRings | `src/lib/components/home/ScoreRings.svelte` | Three circular SVG progress rings |
| TrajectoryCard | `src/lib/components/home/TrajectoryCard.svelte` | Prediction card (emoji + text) |

## Modified Components

| Component | Changes |
|-----------|---------|
| HeroIdentity.svelte | Add contradiction text, gradient avatar ring, emoji vibe pills, sentence archetype |
| home/+page.svelte | Replace InsightCarousel + signal sections with new narrative sections, wire up data |

## Removed

- InsightCarousel usage (component file can stay, just not imported)
- Clinical "INTELLIGENCE / SNAPSHOT / PREDICTION" labels
- Truncating line-clamp on insight text (already fixed)

## Design Tokens

All new components use existing CSS custom properties:
- Glass panels: `--glass-light`, `--glass-medium`, `--border-subtle`
- Colors: `#FF4D4D` (red), `#4D7CFF` (blue), `#FFB84D` (gold)
- Typography: `--font-sans` for body, `--font-mono` for data/scores
- Spacing: generous padding (24px+ between sections)
- Border radius: 16px for cards

## Horizontal Scroll Pattern

```css
.narrative-scroll {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding: 0 24px;
}
.narrative-scroll > * {
  scroll-snap-align: start;
  flex-shrink: 0;
  width: 280px;
}
```

## SVG Charts

All charts are lightweight inline SVG — no charting library. Max 50 lines of SVG per component.

- **Donut**: `<circle>` with `stroke-dasharray` for segments
- **Heatmap**: `<rect>` grid with opacity mapped to activity level
- **Bar chart**: `<rect>` bars with `<text>` labels
- **Score rings**: `<circle>` with `stroke-dasharray` showing progress, number in center

## Intersection Observer Fade-In

Each NarrativeSection fades in when it enters the viewport:
```css
.narrative-section { opacity: 0; transform: translateY(16px); transition: opacity 0.5s, transform 0.5s; }
.narrative-section.visible { opacity: 1; transform: translateY(0); }
```
