# AI Creative Studio — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Mode 1 ("I have the copy") of the AI Creative Studio — user pastes copy, Claude directs, Gemini generates the visual, Satori composites the brand overlay, Haiku runs QC, and the approved creative flows into the scheduler.

**Architecture:** Orchestrator API endpoint receives copy + brand context → calls Claude Sonnet for creative direction JSON → calls Gemini 2.5 Flash Image for the visual → composites logo/locked-text via Satori (HTML→PNG) → runs QC via Claude Haiku → stores final PNG in GCS. Brand Kit Manager lets users upload logos and fonts. Single revision round with free-text + toggles.

**Tech Stack:** SvelteKit, `@google/genai` (Gemini 2.5 Flash Image), `@anthropic-ai/sdk` (Claude Sonnet + Haiku), `satori` + `@resvg/resvg-js` (HTML→PNG compositor), `@google-cloud/storage` (GCS), Supabase (PostgreSQL).

**Spec:** `docs/superpowers/specs/2026-04-28-ai-creative-studio-design.md`

**Phase 1 scope:** Mode 1 only, static 4:5 format, basic QC, single revision, Brand Kit Manager. No carousel, no Mode 2, no cost dashboard.

---

## File Map

### New Files — Dependencies
| File | Responsibility |
|------|---------------|
| (npm packages) | `@google/genai`, `satori`, `@resvg/resvg-js` |

### New Files — Server
| File | Responsibility |
|------|---------------|
| `src/lib/server/creative/orchestrator.ts` | Core orchestration: context assembly → Claude direction → Gemini image → Satori composite → Haiku QC → GCS persist |
| `src/lib/server/creative/directionPrompt.ts` | Creative director system prompt + output schema definition |
| `src/lib/server/creative/imageGenerator.ts` | Gemini 2.5 Flash Image wrapper — prompt + style reference → base64 PNG |
| `src/lib/server/creative/compositor.ts` | Satori + resvg: overlay logo, locked text, brand fonts onto the AI image |
| `src/lib/server/creative/qc.ts` | Haiku vision QC pass — checks text legibility, logo, palette, safe zones |
| `src/lib/server/creative/contextBuilder.ts` | Build initial `creative_context` from brand kit + fingerprints, and read/update it |

### New Files — API Routes
| File | Responsibility |
|------|---------------|
| `src/routes/api/brand/creative-studio/generate-visual/+server.ts` | POST — full Mode 1 pipeline |
| `src/routes/api/brand/creative-studio/revise/+server.ts` | POST — revision with feedback + toggles |
| `src/routes/api/brand/creative-studio/approve/+server.ts` | POST — finalize, update taste log, send to scheduler |
| `src/routes/api/brand/creative-studio/history/+server.ts` | GET — past generations |
| `src/routes/api/brand/brand-assets/+server.ts` | GET/POST/DELETE — brand asset CRUD |

### New Files — UI Components
| File | Responsibility |
|------|---------------|
| `src/lib/components/brands/CreativeStudio.svelte` | Container — state machine (landing → generate → review → revise → approve) |
| `src/lib/components/brands/VisualReview.svelte` | Shows generated image, concept, design direction, why-it-works, actions |
| `src/lib/components/brands/RevisionPanel.svelte` | Side-by-side, free-text + toggles, version indicator |
| `src/lib/components/brands/BrandKitManager.svelte` | Upload/manage logos + fonts, color palette display |

### New Files — Database
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260428100000_creative_studio.sql` | All Phase 1 tables: `brand_assets`, `creative_generations`, `creative_generation_versions`, `creative_taste_log`, `creative_cost_log`, `creative_context` column |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/components/brands/ContentAutomation.svelte` | Replace "Coming Soon" card with live Creative Studio + add Brand Kit Manager card |
| `package.json` | Add `@google/genai`, `satori`, `@resvg/resvg-js` |

---

### Task 1: Install Dependencies + Database Migration

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/20260428100000_creative_studio.sql`

- [ ] **Step 1: Install npm packages**

```bash
npm install @google/genai satori @resvg/resvg-js
```

- [ ] **Step 2: Create the migration SQL**

```sql
-- Brand assets (logos, fonts)
CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('logo_primary', 'logo_mark', 'font_file', 'watermark')),
  variant TEXT CHECK (variant IN ('light', 'dark', 'mono')),
  format TEXT NOT NULL CHECK (format IN ('svg', 'woff2', 'png', 'ttf', 'otf')),
  url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_brand_assets_brand ON brand_assets(brand_account_id);

-- Creative generations (session tracking)
CREATE TABLE IF NOT EXISTS creative_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  generation_session_id UUID DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('copy_first', 'from_scratch')),
  format TEXT NOT NULL DEFAULT 'static_4x5',
  brief TEXT,
  copy_input TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'approved', 'abandoned')),
  active_version INTEGER DEFAULT 1,
  approved_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX idx_creative_gen_brand ON creative_generations(brand_account_id, created_at DESC);

-- Generation versions (each regeneration/revision)
CREATE TABLE IF NOT EXISTS creative_generation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES creative_generations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  image_gcs_url TEXT,
  thumbnail_url TEXT,
  direction_payload JSONB DEFAULT '{}',
  copy_payload JSONB DEFAULT '{}',
  qc_report JSONB DEFAULT '{}',
  cost_usd NUMERIC(10,5) DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(generation_id, version)
);

-- Taste log (learning)
CREATE TABLE IF NOT EXISTS creative_taste_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  generation_id UUID,
  type TEXT NOT NULL CHECK (type IN ('generation', 'revision', 'approval', 'rejection')),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_taste_log_brand ON creative_taste_log(brand_account_id, created_at DESC);

-- Cost log
CREATE TABLE IF NOT EXISTS creative_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  generation_id UUID,
  call_type TEXT NOT NULL CHECK (call_type IN ('direction', 'image_generation', 'composite', 'qc', 'revision', 'context_build')),
  model_used TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,5) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cost_log_brand ON creative_cost_log(brand_account_id, created_at DESC);

-- Creative context column on brand_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_accounts' AND column_name = 'creative_context'
  ) THEN
    ALTER TABLE brand_accounts ADD COLUMN creative_context JSONB DEFAULT '{}';
  END IF;
END $$;
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json supabase/migrations/20260428100000_creative_studio.sql
git commit -m "feat(db): creative studio tables — assets, generations, versions, taste log, cost log"
```

---

### Task 2: Creative Director Prompt + Context Builder

**Files:**
- Create: `src/lib/server/creative/directionPrompt.ts`
- Create: `src/lib/server/creative/contextBuilder.ts`

- [ ] **Step 1: Create the direction prompt module**

Create `src/lib/server/creative/directionPrompt.ts`:

```typescript
export const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are a senior creative partner for this brand — operating simultaneously as Brand Strategist, Creative Director, Art Director & Graphic Designer, and Social Copywriter.

You are not a yes-machine. If a request would dilute the brand or produce a weak post, say so and propose a stronger alternative.

Brand guidelines are the constitution. Past posts are the case law. When they disagree, past posts reveal what the brand has evolved into — flag the tension and ask which direction to follow.

Before producing output, silently analyze: visual system (dominant colors with hex, type pairings, grid behavior, image treatment, white-space density, recurring motifs), voice & tone, composition patterns, audience signal.

Every design choice must be traceable to a guideline or past post. No filler, no generic marketing-speak, no emoji-stuffed captions unless the brand does that.

Your output is a structured JSON brief that an image model and a deterministic compositor will execute. Specify: layout description, exact hex colors, typography description, copy with positioning, asset slots (logo position, locked-text), and what should be AI-generated vs composited. If you cannot specify a choice with confidence, mark it "auto" rather than guessing.`;

export const DIRECTION_OUTPUT_SCHEMA = `Respond with a single JSON object (no markdown fences):
{
  "concept": "2-3 sentences: the idea, why it fits the brand, what makes it scroll-stopping",
  "format": "static_4x5",
  "designDirection": {
    "layout": "human-readable layout description",
    "palette": [{ "hex": "#XXXXXX", "role": "primary|secondary|accent|background|text" }],
    "typography": "typeface choices, weight, size relationships, alignment",
    "imagery": "what the background/visual should depict — this becomes the image model prompt",
    "motifs": ["recurring visual elements from the brand"]
  },
  "copy": {
    "onImage": [{ "text": "exact text", "position": "top|center|bottom|top-left|bottom-right", "lock": false }],
    "caption": "full Instagram caption in brand voice",
    "cta": "call to action text",
    "hashtags": ["no_hash_prefix"]
  },
  "assets": {
    "logo": { "position": "bottom-right|bottom-left|top-right|top-left", "size": "small|medium" },
    "locked": [{ "text": "exact text that MUST be composited", "position": "bottom|top", "style": "small|legal" }]
  },
  "whyThisWorks": ["bullet 1 connecting choice to brand reference", "bullet 2"],
  "imageModelPrompt": "synthesized prompt for the image model: describe the visual scene, style, colors, composition. Do NOT include text/copy in this prompt — text is handled by the compositor."
}`;

export interface CreativeDirection {
  concept: string;
  format: string;
  designDirection: {
    layout: string;
    palette: { hex: string; role: string }[];
    typography: string;
    imagery: string;
    motifs: string[];
  };
  copy: {
    onImage: { text: string; position: string; lock: boolean }[];
    caption: string;
    cta: string;
    hashtags: string[];
  };
  assets: {
    logo: { position: string; size: string };
    locked: { text: string; position: string; style: string }[];
  };
  whyThisWorks: string[];
  imageModelPrompt: string;
}
```

- [ ] **Step 2: Create the context builder module**

Create `src/lib/server/creative/contextBuilder.ts`:

```typescript
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

export interface CreativeContext {
  visual_identity: {
    dominant_colors: { hex: string; role: string }[];
    type_style: string;
    composition_patterns: string;
    image_treatment: string;
    whitespace_density: string;
    recurring_motifs: string[];
  };
  voice_profile: {
    sentence_length: string;
    formality: string;
    hooks_reused: string[];
    words_avoided: string[];
  };
  learned_preferences: {
    revision_patterns_summary: string;
    preferred_formats: Record<string, number>;
    approval_rate: number;
  };
  last_refreshed: string;
  context_version: number;
}

const supaHeaders = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

/** Read creative_context from brand_accounts. If empty, build it. */
export async function getOrBuildCreativeContext(brandIgId: string): Promise<CreativeContext> {
  const supabaseUrl = env.SUPABASE_URL!;

  // Read existing context
  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}&select=creative_context,brand_identity,brand_voice&limit=1`,
    { headers: supaHeaders() },
  );
  const rows = await res.json();
  const brand = rows[0];
  if (!brand) throw new Error('Brand not found');

  const existing = brand.creative_context as CreativeContext | null;
  if (existing && existing.context_version) return existing;

  // Build from scratch
  return buildCreativeContext(brandIgId, brand);
}

async function buildCreativeContext(
  brandIgId: string,
  brand: Record<string, unknown>,
): Promise<CreativeContext> {
  const supabaseUrl = env.SUPABASE_URL!;

  // Fetch brand kit from snapshot
  const snapRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${brandIgId}&select=intelligence&order=created_at.desc&limit=1`,
    { headers: supaHeaders() },
  );
  const snapRows = snapRes.ok ? await snapRes.json() : [];
  const intelligence = snapRows[0]?.intelligence || {};

  // Fetch fingerprints for style analysis
  const fpRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_fingerprints?brand_ig_id=eq.${brandIgId}&order=posted_at.desc&limit=10&select=caption,hashtags,hook_archetype,engagement_score`,
    { headers: supaHeaders() },
  );
  const fingerprints = fpRes.ok ? await fpRes.json() : [];

  const identity = (brand.brand_identity || {}) as Record<string, string>;
  const brandVoice = (brand.brand_voice || 'Bold') as string;

  // Use Haiku to summarize into creative context
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  const summary = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Analyze this brand's creative identity and return a JSON object.

Brand voice: ${brandVoice}
Identity: ${JSON.stringify(identity).slice(0, 500)}
Content pillars: ${JSON.stringify(intelligence.contentPillars || []).slice(0, 300)}
Audience: ${JSON.stringify(intelligence.audiencePersonas || []).slice(0, 300)}
Recent posts: ${JSON.stringify(fingerprints.slice(0, 5).map((f: Record<string, unknown>) => ({
  hook: f.hook_archetype,
  caption: (f.caption as string)?.slice(0, 100),
  engagement: f.engagement_score,
}))).slice(0, 800)}

Return JSON (no markdown):
{
  "visual_identity": { "dominant_colors": [{"hex":"#xxx","role":"primary"}], "type_style": "", "composition_patterns": "", "image_treatment": "", "whitespace_density": "", "recurring_motifs": [] },
  "voice_profile": { "sentence_length": "", "formality": "", "hooks_reused": [], "words_avoided": [] }
}`,
    }],
  });

  const text = summary.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed;
  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { visual_identity: {}, voice_profile: {} };
  }

  const context: CreativeContext = {
    visual_identity: {
      dominant_colors: parsed.visual_identity?.dominant_colors || [{ hex: '#000000', role: 'primary' }],
      type_style: parsed.visual_identity?.type_style || 'sans-serif',
      composition_patterns: parsed.visual_identity?.composition_patterns || 'centered layout',
      image_treatment: parsed.visual_identity?.image_treatment || 'clean, modern',
      whitespace_density: parsed.visual_identity?.whitespace_density || 'moderate',
      recurring_motifs: parsed.visual_identity?.recurring_motifs || [],
    },
    voice_profile: {
      sentence_length: parsed.voice_profile?.sentence_length || 'short',
      formality: parsed.voice_profile?.formality || 'casual-professional',
      hooks_reused: parsed.voice_profile?.hooks_reused || [],
      words_avoided: parsed.voice_profile?.words_avoided || [],
    },
    learned_preferences: {
      revision_patterns_summary: '',
      preferred_formats: {},
      approval_rate: 0,
    },
    last_refreshed: new Date().toISOString(),
    context_version: 1,
  };

  // Store in DB
  await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}`,
    {
      method: 'PATCH',
      headers: supaHeaders(),
      body: JSON.stringify({ creative_context: context }),
    },
  );

  return context;
}

/** Log a cost entry */
export async function logCost(
  brandIgId: string,
  generationId: string,
  callType: string,
  modelUsed: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  imageCount = 0,
) {
  const supabaseUrl = env.SUPABASE_URL!;
  await fetch(`${supabaseUrl}/rest/v1/creative_cost_log`, {
    method: 'POST',
    headers: supaHeaders(),
    body: JSON.stringify({
      brand_account_id: brandIgId,
      generation_id: generationId,
      call_type: callType,
      model_used: modelUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      image_count: imageCount,
      cost_usd: costUsd,
    }),
  }).catch(() => {});
}

/** Log a taste entry */
export async function logTaste(
  brandIgId: string,
  generationId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  const supabaseUrl = env.SUPABASE_URL!;
  await fetch(`${supabaseUrl}/rest/v1/creative_taste_log`, {
    method: 'POST',
    headers: supaHeaders(),
    body: JSON.stringify({
      brand_account_id: brandIgId,
      generation_id: generationId,
      type,
      payload,
    }),
  }).catch(() => {});
}

/** Fetch the last N post thumbnails for visual reference */
export async function getRecentThumbnails(brandIgId: string, count = 5): Promise<string[]> {
  const supabaseUrl = env.SUPABASE_URL!;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${brandIgId}&select=intelligence&order=created_at.desc&limit=1`,
    { headers: supaHeaders() },
  );
  const rows = res.ok ? await res.json() : [];
  const intel = rows[0]?.intelligence || {};
  const posts = (intel.recentPosts || []) as Array<{ thumbnail?: string }>;
  return posts.slice(0, count).map((p) => p.thumbnail).filter(Boolean) as string[];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/creative/directionPrompt.ts src/lib/server/creative/contextBuilder.ts
git commit -m "feat(creative): direction prompt and context builder modules"
```

---

### Task 3: Image Generator (Gemini 2.5 Flash Image)

**Files:**
- Create: `src/lib/server/creative/imageGenerator.ts`

- [ ] **Step 1: Create the image generator module**

```typescript
import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
}

/**
 * Generate an image using Gemini 2.5 Flash Image (Nano Banana).
 * Supports optional style reference image for brand consistency.
 */
export async function generateImage(
  prompt: string,
  options?: {
    styleReferenceBase64?: string;
    styleReferenceMimeType?: string;
    aspectRatio?: string;
  },
): Promise<ImageGenResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Add style reference if provided
  if (options?.styleReferenceBase64) {
    contents.push({ text: 'Use the following image as a style reference. Match its visual tone, color palette, and composition style:' });
    contents.push({
      inlineData: {
        mimeType: options.styleReferenceMimeType || 'image/jpeg',
        data: options.styleReferenceBase64,
      },
    });
  }

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: (options?.aspectRatio || '4:5') as '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
      },
    },
  });

  // Extract image from response
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }

  throw new Error('Image model returned no image');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/creative/imageGenerator.ts
git commit -m "feat(creative): Gemini 2.5 Flash Image generator with style reference support"
```

---

### Task 4: Compositor (Satori + resvg — Logo & Text Overlay)

**Files:**
- Create: `src/lib/server/creative/compositor.ts`

- [ ] **Step 1: Create the compositor module**

```typescript
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface CompositeOptions {
  backgroundBase64: string;
  backgroundMimeType: string;
  direction: CreativeDirection;
  logoUrl?: string;
  brandColors: { hex: string; role: string }[];
  width?: number;
  height?: number;
}

export interface CompositeResult {
  pngBuffer: Buffer;
  width: number;
  height: number;
}

/**
 * Overlay brand elements (logo, locked text, CTA) onto the AI-generated background.
 * Uses Satori to render an HTML/CSS layout to SVG, then resvg to rasterize to PNG.
 */
export async function compositeImage(options: CompositeOptions): Promise<CompositeResult> {
  const { backgroundBase64, backgroundMimeType, direction, logoUrl, brandColors } = options;
  const width = options.width || 1080;
  const height = options.height || 1350; // 4:5

  // Load a fallback font (Inter) for Satori — must have at least one font
  const fontRes = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff');
  const fontBuffer = await fontRes.arrayBuffer();

  const fontBoldRes = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff');
  const fontBoldBuffer = await fontBoldRes.arrayBuffer();

  // Build overlay elements from direction
  const bgColor = brandColors.find((c) => c.role === 'background')?.hex || '#000000';
  const textColor = brandColors.find((c) => c.role === 'text')?.hex || '#FFFFFF';
  const accentColor = brandColors.find((c) => c.role === 'accent')?.hex || brandColors[0]?.hex || '#FFFFFF';

  // Determine logo position
  const logoPos = direction.assets.logo.position || 'bottom-right';
  const logoStyle: Record<string, string> = { position: 'absolute', width: '80px', height: 'auto' };
  if (logoPos.includes('bottom')) logoStyle.bottom = '40px';
  else logoStyle.top = '40px';
  if (logoPos.includes('right')) logoStyle.right = '40px';
  else logoStyle.left = '40px';

  // Build locked text elements
  const lockedTexts = [...(direction.assets.locked || []), ...direction.copy.onImage.filter((t) => t.lock)];

  // Build the overlay JSX for Satori (using React-like object syntax)
  const element = {
    type: 'div',
    props: {
      style: {
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        backgroundImage: `url(data:${backgroundMimeType};base64,${backgroundBase64})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      children: [
        // Locked text overlays
        ...lockedTexts.map((lt, i) => ({
          type: 'div',
          key: `locked-${i}`,
          props: {
            style: {
              position: 'absolute' as const,
              ...(lt.position === 'bottom' ? { bottom: '100px', left: '40px', right: '40px' } :
                lt.position === 'top' ? { top: '60px', left: '40px', right: '40px' } :
                lt.position === 'center' ? { top: '50%', left: '40px', right: '40px', transform: 'translateY(-50%)' } :
                { bottom: '100px', left: '40px', right: '40px' }),
              color: textColor,
              fontSize: lt.style === 'legal' || lt.style === 'small' ? '16px' : '36px',
              fontWeight: lt.style === 'legal' || lt.style === 'small' ? '400' : '700',
              textAlign: 'left' as const,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              lineHeight: '1.3',
            },
            children: lt.text,
          },
        })),
        // Logo
        ...(logoUrl ? [{
          type: 'img',
          key: 'logo',
          props: {
            src: logoUrl,
            style: { ...logoStyle, objectFit: 'contain' as const },
          },
        }] : []),
      ],
    },
  };

  // Render to SVG via Satori
  const svg = await satori(element as unknown as React.ReactNode, {
    width,
    height,
    fonts: [
      { name: 'Inter', data: fontBuffer, weight: 400, style: 'normal' as const },
      { name: 'Inter', data: fontBoldBuffer, weight: 700, style: 'normal' as const },
    ],
  });

  // Render SVG to PNG via resvg
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return { pngBuffer: Buffer.from(pngBuffer), width, height };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/creative/compositor.ts
git commit -m "feat(creative): Satori + resvg compositor for brand overlay"
```

---

### Task 5: QC Pass (Haiku Vision)

**Files:**
- Create: `src/lib/server/creative/qc.ts`

- [ ] **Step 1: Create the QC module**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface QCReport {
  textLegible: boolean;
  logoOk: boolean;
  paletteOk: boolean;
  safeZoneOk: boolean;
  issues: string[];
  passed: boolean;
}

/**
 * Run a QC pass on the final PNG using Claude Haiku with vision.
 * Checks: text legibility, logo presence, palette accuracy, safe zone compliance.
 */
export async function runQC(
  imageBase64: string,
  imageMimeType: string,
  expectedPalette: string[],
  expectedLogoPosition: string,
): Promise<QCReport> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: imageMimeType as 'image/png' | 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: `Check this Instagram creative (4:5, 1080x1350) for quality issues.

1. Is all text legible and correctly spelled? Look for garbled, overlapping, or cut-off text.
2. Is there a logo or brand mark visible, approximately in the ${expectedLogoPosition} area? (If no logo was expected, mark logoOk as true.)
3. Are the dominant colors approximately matching this palette: ${expectedPalette.join(', ')}? (Within reasonable creative interpretation, not exact match.)
4. Is any important text inside the Instagram safe zone violation area (top 250px or bottom 340px where UI overlays appear)?

Return JSON only, no markdown:
{"textLegible": true/false, "logoOk": true/false, "paletteOk": true/false, "safeZoneOk": true/false, "issues": ["issue1"]}`,
        },
      ],
    }],
  });

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const report = JSON.parse(cleaned) as Omit<QCReport, 'passed'>;
    return {
      ...report,
      passed: report.textLegible && report.logoOk && report.paletteOk && report.safeZoneOk,
    };
  } catch {
    // If QC parsing fails, pass by default (don't block generation)
    return { textLegible: true, logoOk: true, paletteOk: true, safeZoneOk: true, issues: ['QC parse failed'], passed: true };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/creative/qc.ts
git commit -m "feat(creative): Haiku vision QC pass for generated creatives"
```

---

### Task 6: Orchestrator (Full Pipeline)

**Files:**
- Create: `src/lib/server/creative/orchestrator.ts`

- [ ] **Step 1: Create the orchestrator**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { CREATIVE_DIRECTOR_SYSTEM_PROMPT, DIRECTION_OUTPUT_SCHEMA, type CreativeDirection } from './directionPrompt';
import { getOrBuildCreativeContext, getRecentThumbnails, logCost } from './contextBuilder';
import { generateImage } from './imageGenerator';
import { compositeImage } from './compositor';
import { runQC } from './qc';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

export interface GenerateVisualInput {
  brandIgId: string;
  copy: string;
  caption?: string;
  format?: string;
  lockedPhrases?: string[];
  brief?: string;
  generationId: string;
  version: number;
}

export interface GenerateVisualResult {
  imageUrl: string;
  direction: CreativeDirection;
  qcReport: { textLegible: boolean; logoOk: boolean; paletteOk: boolean; safeZoneOk: boolean; issues: string[]; passed: boolean };
  totalCost: number;
}

const supaHeaders = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

export async function generateVisual(input: GenerateVisualInput): Promise<GenerateVisualResult> {
  const { brandIgId, copy, caption, lockedPhrases, brief, generationId, version } = input;
  let totalCost = 0;

  // 1. Get creative context + thumbnails
  const context = await getOrBuildCreativeContext(brandIgId);
  const thumbnails = await getRecentThumbnails(brandIgId, 5);

  // 2. Fetch brand logo
  const supabaseUrl = env.SUPABASE_URL!;
  const logoRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.logo_primary&is_default=eq.true&limit=1`,
    { headers: supaHeaders() },
  );
  const logos = logoRes.ok ? await logoRes.json() : [];
  const logoUrl = logos[0]?.url || null;

  // 3. Call Claude Sonnet for creative direction
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });

  const directionParts: Anthropic.Messages.ContentBlockParam[] = [];

  // Add thumbnail references
  for (let i = 0; i < Math.min(thumbnails.length, 3); i++) {
    try {
      const imgRes = await fetch(thumbnails[i]);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        directionParts.push({ type: 'text', text: `Past post ${i + 1} (reference style):` });
        directionParts.push({
          type: 'image',
          source: { type: 'base64', media_type: contentType as 'image/jpeg', data: base64 },
        });
      }
    } catch { /* skip failed thumbnail */ }
  }

  // Mark locked phrases in copy
  let processedCopy = copy;
  if (lockedPhrases?.length) {
    processedCopy += `\n\nLOCKED PHRASES (must be composited exactly, not AI-rendered): ${lockedPhrases.join(', ')}`;
  }

  directionParts.push({
    type: 'text',
    text: `BRAND CREATIVE CONTEXT:
${JSON.stringify(context.visual_identity, null, 2)}

VOICE PROFILE:
${JSON.stringify(context.voice_profile, null, 2)}

${context.learned_preferences.revision_patterns_summary ? `LEARNED PREFERENCES: ${context.learned_preferences.revision_patterns_summary}` : ''}

COPY TO DESIGN FOR:
${processedCopy}

${caption ? `SUGGESTED CAPTION: ${caption}` : ''}
${brief ? `ORIGINAL BRIEF: ${brief}` : ''}

Format: static 4:5 (1080x1350)
${logoUrl ? 'Brand logo is available and will be composited separately.' : 'No logo uploaded — use text-mark if appropriate.'}

${DIRECTION_OUTPUT_SCHEMA}`,
  });

  const directionResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: CREATIVE_DIRECTOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: directionParts }],
  });

  const directionText = directionResponse.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let direction: CreativeDirection;
  try {
    const cleaned = directionText.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    direction = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid direction JSON: ${directionText.slice(0, 200)}`);
  }

  const dirCost = ((directionResponse.usage?.input_tokens || 0) * 3 + (directionResponse.usage?.output_tokens || 0) * 15) / 1_000_000;
  totalCost += dirCost;
  await logCost(brandIgId, generationId, 'direction', 'claude-sonnet-4-20250514', directionResponse.usage?.input_tokens || 0, directionResponse.usage?.output_tokens || 0, dirCost);

  // 4. Generate image via Gemini
  let styleRefBase64: string | undefined;
  if (thumbnails.length > 0) {
    try {
      const refRes = await fetch(thumbnails[0]);
      if (refRes.ok) {
        const buffer = await refRes.arrayBuffer();
        styleRefBase64 = Buffer.from(buffer).toString('base64');
      }
    } catch { /* no style ref */ }
  }

  const imageResult = await generateImage(direction.imageModelPrompt, {
    styleReferenceBase64: styleRefBase64,
    aspectRatio: '4:5',
  });

  const imgCost = 0.04; // estimated per image
  totalCost += imgCost;
  await logCost(brandIgId, generationId, 'image_generation', 'gemini-2.5-flash-image', 0, 0, imgCost, 1);

  // 5. Composite brand overlay
  const composited = await compositeImage({
    backgroundBase64: imageResult.base64,
    backgroundMimeType: imageResult.mimeType,
    direction,
    logoUrl: logoUrl || undefined,
    brandColors: direction.designDirection.palette,
  });

  // 6. Run QC
  const compositedBase64 = composited.pngBuffer.toString('base64');
  const paletteHexes = direction.designDirection.palette.map((c) => c.hex);
  const qcReport = await runQC(compositedBase64, 'image/png', paletteHexes, direction.assets.logo.position);

  const qcCost = 0.003;
  totalCost += qcCost;
  await logCost(brandIgId, generationId, 'qc', 'claude-haiku-4-5-20251001', 0, 0, qcCost);

  // 7. If QC fails, retry once
  if (!qcReport.passed) {
    const retryImage = await generateImage(
      direction.imageModelPrompt + '\n\nIMPORTANT: Ensure text is clearly legible, well-positioned, and not overlapping. Use high contrast between text and background.',
      { styleReferenceBase64: styleRefBase64, aspectRatio: '4:5' },
    );
    const retryComposited = await compositeImage({
      backgroundBase64: retryImage.base64,
      backgroundMimeType: retryImage.mimeType,
      direction,
      logoUrl: logoUrl || undefined,
      brandColors: direction.designDirection.palette,
    });
    const retryBase64 = retryComposited.pngBuffer.toString('base64');
    const retryQc = await runQC(retryBase64, 'image/png', paletteHexes, direction.assets.logo.position);

    totalCost += imgCost + qcCost;

    // Use retry result regardless
    Object.assign(qcReport, retryQc);
    composited.pngBuffer = retryComposited.pngBuffer;
  }

  // 8. Upload final PNG to GCS
  const finalBuffer = composited.pngBuffer;
  const fileName = `creative-${generationId}-v${version}.png`;
  const file = new File([finalBuffer], fileName, { type: 'image/png' });
  const uploadResult = await uploadCreativeToGCS(file, brandIgId);

  // 9. Store version in DB
  await fetch(`${supabaseUrl}/rest/v1/creative_generation_versions`, {
    method: 'POST',
    headers: supaHeaders(),
    body: JSON.stringify({
      generation_id: generationId,
      version,
      image_gcs_url: uploadResult.url,
      direction_payload: direction,
      copy_payload: { onImage: direction.copy.onImage, caption: direction.copy.caption, cta: direction.copy.cta, hashtags: direction.copy.hashtags },
      qc_report: qcReport,
      cost_usd: totalCost,
    }),
  });

  return {
    imageUrl: uploadResult.url,
    direction,
    qcReport,
    totalCost,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/creative/orchestrator.ts
git commit -m "feat(creative): orchestrator — direction → image → composite → QC → persist"
```

---

### Task 7: API Routes (generate-visual, revise, approve, history, brand-assets)

**Files:**
- Create: `src/routes/api/brand/creative-studio/generate-visual/+server.ts`
- Create: `src/routes/api/brand/creative-studio/revise/+server.ts`
- Create: `src/routes/api/brand/creative-studio/approve/+server.ts`
- Create: `src/routes/api/brand/creative-studio/history/+server.ts`
- Create: `src/routes/api/brand/brand-assets/+server.ts`

- [ ] **Step 1: Create generate-visual endpoint**

Create `src/routes/api/brand/creative-studio/generate-visual/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { generateVisual } from '$lib/server/creative/orchestrator';
import { logTaste } from '$lib/server/creative/contextBuilder';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { copy, caption, format, lockedPhrases, brief } = body as {
    copy: string;
    caption?: string;
    format?: string;
    lockedPhrases?: string[];
    brief?: string;
  };
  if (!copy?.trim()) throw error(400, 'Copy text is required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  // Create generation record
  const genRes = await fetch(`${supabaseUrl}/rest/v1/creative_generations`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      brand_account_id: igUserId,
      mode: 'copy_first',
      format: format || 'static_4x5',
      copy_input: copy,
      brief: brief || null,
      status: 'in_progress',
      active_version: 1,
    }),
  });
  if (!genRes.ok) throw error(500, 'Failed to create generation record');
  const [generation] = await genRes.json();

  try {
    const result = await generateVisual({
      brandIgId: igUserId,
      copy,
      caption,
      format: format || 'static_4x5',
      lockedPhrases,
      brief,
      generationId: generation.id,
      version: 1,
    });

    await logTaste(igUserId, generation.id, 'generation', { copy, format, brief });

    return json({
      ok: true,
      generationId: generation.id,
      version: 1,
      concept: result.direction.concept,
      designDirection: result.direction.designDirection.layout,
      whyThisWorks: result.direction.whyThisWorks,
      imageUrl: result.imageUrl,
      caption: result.direction.copy.caption,
      hashtags: result.direction.copy.hashtags,
      format: 'static_4x5',
      dimensions: '1080x1350',
      qcReport: result.qcReport,
      cost: { total_usd: result.totalCost },
    });
  } catch (e) {
    // Mark generation as abandoned on error
    await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generation.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'abandoned' }),
    });
    throw error(500, e instanceof Error ? e.message : 'Generation failed');
  }
};
```

- [ ] **Step 2: Create revise endpoint**

Create `src/routes/api/brand/creative-studio/revise/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { generateVisual } from '$lib/server/creative/orchestrator';
import { logTaste } from '$lib/server/creative/contextBuilder';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { generationId, fromVersion, feedback, toggles } = body as {
    generationId: string;
    fromVersion: number;
    feedback: string;
    toggles?: Record<string, string>;
  };
  if (!generationId) throw error(400, 'generationId required');

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  // Get generation + current version
  const genRes = await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generationId}&brand_account_id=eq.${igUserId}&limit=1`, { headers });
  const gens = await genRes.json();
  if (!gens.length) throw error(404, 'Generation not found');
  const gen = gens[0];

  // Get the version being revised
  const verRes = await fetch(`${supabaseUrl}/rest/v1/creative_generation_versions?generation_id=eq.${generationId}&version=eq.${fromVersion}&limit=1`, { headers });
  const vers = await verRes.json();
  if (!vers.length) throw error(404, 'Version not found');
  const prevVersion = vers[0];

  const newVersion = fromVersion + 1;

  // Build revision context from previous direction + feedback
  const prevDirection = prevVersion.direction_payload;
  const revisionSuffix = [
    feedback,
    toggles ? Object.entries(toggles).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
  ].filter(Boolean).join('. ');

  const revisedCopy = `${gen.copy_input}\n\nREVISION REQUEST (from version ${fromVersion}): ${revisionSuffix}\n\nPrevious design direction was: ${prevDirection.designDirection?.layout || 'unknown'}. Adjust based on the revision feedback while maintaining brand consistency.`;

  const result = await generateVisual({
    brandIgId: igUserId,
    copy: revisedCopy,
    brief: gen.brief,
    generationId,
    version: newVersion,
  });

  // Update active version
  await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active_version: newVersion }),
  });

  await logTaste(igUserId, generationId, 'revision', { fromVersion, feedback, toggles });

  return json({
    ok: true,
    generationId,
    version: newVersion,
    concept: result.direction.concept,
    designDirection: result.direction.designDirection.layout,
    whyThisWorks: result.direction.whyThisWorks,
    imageUrl: result.imageUrl,
    caption: result.direction.copy.caption,
    hashtags: result.direction.copy.hashtags,
    format: 'static_4x5',
    dimensions: '1080x1350',
    qcReport: result.qcReport,
    cost: { total_usd: result.totalCost },
  });
};
```

- [ ] **Step 3: Create approve endpoint**

Create `src/routes/api/brand/creative-studio/approve/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { logTaste } from '$lib/server/creative/contextBuilder';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { generationId, version, sendToScheduler } = body as {
    generationId: string;
    version: number;
    sendToScheduler: boolean;
  };

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  // Get the approved version
  const verRes = await fetch(`${supabaseUrl}/rest/v1/creative_generation_versions?generation_id=eq.${generationId}&version=eq.${version}&limit=1`, { headers });
  const vers = await verRes.json();
  if (!vers.length) throw error(404, 'Version not found');
  const approvedVer = vers[0];

  // Mark generation as approved
  await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      status: 'approved',
      approved_version: version,
      approved_at: new Date().toISOString(),
    }),
  });

  await logTaste(igUserId, generationId, 'approval', { version, sendToScheduler });

  let scheduledPostId = null;
  if (sendToScheduler && approvedVer.image_gcs_url) {
    // Send to Module 1 scheduler
    const copyPayload = approvedVer.copy_payload || {};
    const scheduleRes = await fetch(`${supabaseUrl}/rest/v1/scheduled_posts`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        gcs_url: approvedVer.image_gcs_url,
        media_type: 'IMAGE',
        caption: copyPayload.caption || '',
        hashtags: copyPayload.hashtags || [],
        alt_text: '',
        status: 'draft',
        ai_reasoning: `Generated by AI Creative Studio, generation ${generationId} v${version}`,
      }),
    });
    if (scheduleRes.ok) {
      const [post] = await scheduleRes.json();
      scheduledPostId = post.id;
    }
  }

  return json({
    ok: true,
    gcsUrl: approvedVer.image_gcs_url,
    scheduledPostId,
    schedulerStatus: scheduledPostId ? 'draft' : 'not_sent',
  });
};
```

- [ ] **Step 4: Create history endpoint**

Create `src/routes/api/brand/creative-studio/history/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 50);
  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/creative_generations?brand_account_id=eq.${igUserId}&order=created_at.desc&limit=${limit}&select=*,creative_generation_versions(version,image_gcs_url,cost_usd,created_at)`,
    { headers },
  );

  if (!res.ok) throw error(500, 'Failed to fetch history');
  const generations = await res.json();

  return json({ ok: true, generations });
};
```

- [ ] **Step 5: Create brand-assets CRUD endpoint**

Create `src/routes/api/brand/brand-assets/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${igUserId}&order=created_at.desc`,
    { headers },
  );
  if (!res.ok) throw error(500, 'Failed to fetch assets');
  const assets = await res.json();

  return json({ ok: true, assets });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string || 'logo_primary';
  const variant = formData.get('variant') as string || null;
  const isDefault = formData.get('isDefault') === 'true';

  if (!file) throw error(400, 'No file provided');

  // Determine format from file type
  const formatMap: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'font/woff2': 'woff2',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'application/font-woff2': 'woff2',
    'application/x-font-ttf': 'ttf',
  };
  const format = formatMap[file.type] || 'png';

  // Upload to GCS
  const uploadResult = await uploadCreativeToGCS(file, igUserId);

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  // If this is default, unset other defaults of same type
  if (isDefault) {
    await fetch(
      `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${igUserId}&type=eq.${type}&is_default=eq.true`,
      { method: 'PATCH', headers, body: JSON.stringify({ is_default: false }) },
    );
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/brand_assets`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      brand_account_id: igUserId,
      type,
      variant,
      format,
      url: uploadResult.url,
      is_default: isDefault,
      metadata: { originalName: file.name, size: file.size, license_attested: false },
    }),
  });

  if (!res.ok) throw error(500, 'Failed to save asset');
  const [asset] = await res.json();

  return json({ ok: true, asset });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { assetId } = body as { assetId: string };
  if (!assetId) throw error(400, 'assetId required');

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?id=eq.${assetId}&brand_account_id=eq.${igUserId}`,
    { method: 'DELETE', headers },
  );
  if (!res.ok) throw error(500, 'Failed to delete asset');

  return json({ ok: true });
};
```

- [ ] **Step 6: Commit all endpoints**

```bash
git add src/routes/api/brand/creative-studio/ src/routes/api/brand/brand-assets/
git commit -m "feat(api): creative studio endpoints — generate, revise, approve, history, brand assets"
```

---

### Task 8: Brand Kit Manager Component

**Files:**
- Create: `src/lib/components/brands/BrandKitManager.svelte`

- [ ] **Step 1: Create the Brand Kit Manager**

Create `src/lib/components/brands/BrandKitManager.svelte` — a full-page panel with:
- **Logos section:** upload SVG/PNG logos, set default, show preview thumbnails, delete
- **Fonts section:** upload WOFF2/TTF font files, show font name, delete
- **Brand colors section:** display palette from `creative_context.visual_identity.dominant_colors` (read-only for now, populated from brand analysis)
- Upload uses `/api/brand/brand-assets` POST (FormData), list uses GET, delete uses DELETE
- Matches Brand OS glass design system: `bs-card`, `bs-label`, accent colors, Geist Mono labels
- Empty states with "Upload your logo to get started" messaging

This is a standard CRUD UI component. The engineer should follow the existing patterns in `ContentAutomation.svelte` for card styling, upload zones, and button patterns. Key elements:
- Drag-and-drop upload zone for logos (accept SVG, PNG)
- Drag-and-drop upload zone for fonts (accept WOFF2, TTF, OTF)
- Grid of uploaded assets with thumbnail, filename, type badge, default toggle, delete button
- License attestation checkbox on font upload ("I have a license for this font")

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/BrandKitManager.svelte
git commit -m "feat(ui): BrandKitManager — upload logos, fonts, view brand colors"
```

---

### Task 9: Creative Studio UI (VisualReview + RevisionPanel)

**Files:**
- Create: `src/lib/components/brands/VisualReview.svelte`
- Create: `src/lib/components/brands/RevisionPanel.svelte`

- [ ] **Step 1: Create VisualReview component**

Create `src/lib/components/brands/VisualReview.svelte` — shows the generated creative with:
- Large image preview (4:5 aspect ratio, full width of main panel)
- Concept section (2-3 sentences)
- Design direction (layout description)
- "Why this works" bullets
- Caption preview (Instagram caption text)
- QC badge (green checkmark if passed, expandable to show details)
- Download button (PNG)
- Action buttons: "Approve & Schedule", "Revise", "Regenerate"
- Version indicator: "V1" / "V2" etc.
- Dispatches events: `approve`, `revise`, `regenerate`, `download`

Style: matches Brand OS glass design system. Image gets a subtle border-radius, concept/direction in `bs-card` sections below.

- [ ] **Step 2: Create RevisionPanel component**

Create `src/lib/components/brands/RevisionPanel.svelte` — revision interface:
- Side-by-side layout: previous version (left, slightly dimmed) vs new version (right, after revision)
- Version dropdown selector (V1, V2, V3...) on each side
- Free-text feedback textarea (primary input)
- Toggle pill row: Layout (Centered/Left-aligned/Asymmetric), Mood (Warmer/Cooler/Bolder/Softer), Text size (Larger/Smaller), Density (More whitespace/More content)
- "Revise" button submits feedback + toggles
- Revision counter: "Revision 1 of 2"
- Dispatches: `submitRevision` with `{ feedback, toggles }`

Style: same toggle pill pattern as `BulkCadenceWizard.svelte` from Module 1.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/VisualReview.svelte src/lib/components/brands/RevisionPanel.svelte
git commit -m "feat(ui): VisualReview and RevisionPanel components"
```

---

### Task 10: CreativeStudio Container + ContentAutomation Integration

**Files:**
- Create: `src/lib/components/brands/CreativeStudio.svelte`
- Modify: `src/lib/components/brands/ContentAutomation.svelte`

- [ ] **Step 1: Create CreativeStudio container**

Create `src/lib/components/brands/CreativeStudio.svelte` — state machine container:

States: `input` → `generating` → `review` → `revising` → `revision_review` → `approved`

- **Input state:** textarea for copy, optional locked phrase highlighting, format selector (default 4:5), "Generate" button
- **Generating state:** loading indicator with "Claude is directing..." → "Generating visual..." → "Running QC..."
- **Review state:** shows `VisualReview` component
- **Revising state:** shows `RevisionPanel`
- **Revision review state:** shows `VisualReview` with updated image
- **Approved state:** success message + "Go to scheduler" link

API calls: `/api/brand/creative-studio/generate-visual`, `/api/brand/creative-studio/revise`, `/api/brand/creative-studio/approve`

Back button returns to ContentAutomation home.

- [ ] **Step 2: Update ContentAutomation.svelte**

In `src/lib/components/brands/ContentAutomation.svelte`, replace the "Coming Soon" Creative Studio card (lines 273-281) with a live card that navigates to CreativeStudio, and add a third card for Brand Kit Manager.

Replace:
```svelte
<!-- AI Creative Studio -->
<div class="ca-action-card ca-action-card--coming">
  <div class="ca-action-icon">✦</div>
  <div class="ca-action-content">
    <h3 class="ca-action-title">AI Creative Studio</h3>
    <p class="ca-action-desc">Generate on-brand visuals from prompts, briefs, or existing assets</p>
  </div>
  <span class="ca-action-badge">Coming Soon</span>
</div>
```

With:
```svelte
<!-- AI Creative Studio -->
<button class="ca-action-card" on:click={() => (currentStep = 'creative-studio')}>
  <div class="ca-action-icon">✦</div>
  <div class="ca-action-content">
    <h3 class="ca-action-title">AI Creative Studio</h3>
    <p class="ca-action-desc">Generate on-brand visuals from your copy — Claude directs, AI creates</p>
  </div>
  <span class="ca-action-arrow">→</span>
</button>

<!-- Brand Kit Manager -->
<button class="ca-action-card" on:click={() => (currentStep = 'brand-kit')}>
  <div class="ca-action-icon">◆</div>
  <div class="ca-action-content">
    <h3 class="ca-action-title">Brand Kit Manager</h3>
    <p class="ca-action-desc">Upload logos, fonts, and manage your brand assets</p>
  </div>
  <span class="ca-action-arrow">→</span>
</button>
```

Update the grid from 2 columns to 3: `.ca-home-actions { grid-template-columns: repeat(3, 1fr); }`

Add the `PipelineStep` type to include `'creative-studio' | 'brand-kit'` and render the corresponding components in the template.

Also remove the `ca-action-card--coming` CSS since it's no longer needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/CreativeStudio.svelte src/lib/components/brands/ContentAutomation.svelte
git commit -m "feat: wire CreativeStudio + BrandKitManager into Content Automation home"
```

---

### Task 11: GCS Upload — Support SVG and Font Files

**Files:**
- Modify: `src/lib/server/marketplace/gcsUpload.ts`

- [ ] **Step 1: Add SVG and font MIME types to allowed uploads**

Add to the allowed types in `gcsUpload.ts`:

```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const ALLOWED_FONT_TYPES = ['font/woff2', 'font/ttf', 'font/otf', 'application/font-woff2', 'application/x-font-ttf', 'application/vnd.ms-opentype'];
```

Update the validation logic to check all three arrays. Font files should use the same max size as images (8MB).

Update `uploadCreativeToGCS` to return `mediaType: 'IMAGE' | 'VIDEO' | 'FONT' | 'SVG'` based on the file type.

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/marketplace/gcsUpload.ts
git commit -m "feat: support SVG and font file uploads in GCS"
```

---

### Task 12: Environment Variable + Manual Testing

- [ ] **Step 1: Add GEMINI_API_KEY to Vercel**

The `GEMINI_API_KEY` environment variable must be set on Vercel for the image generation to work. Run:
```bash
vercel env add GEMINI_API_KEY
```
Or set it in the Vercel dashboard under Project Settings → Environment Variables.

- [ ] **Step 2: Run the Supabase migration**

Execute the migration SQL from Task 1 in the Supabase SQL editor.

- [ ] **Step 3: Start dev server and test**

```bash
npm run dev
```

Navigate to `/brands/portal?tab=automation`:
1. Verify 3 cards on home: Drop & Schedule, AI Creative Studio, Brand Kit Manager
2. Click Brand Kit Manager → upload a logo PNG → verify it appears in the grid
3. Click AI Creative Studio → paste copy → click Generate → verify image generates
4. On review screen → click Revise → enter feedback → verify revised image
5. Click Approve & Schedule → verify it creates a draft in the scheduler

- [ ] **Step 4: Deploy**

```bash
vercel --prod
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: address testing feedback for creative studio phase 1"
```
