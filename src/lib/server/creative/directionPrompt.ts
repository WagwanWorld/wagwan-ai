export const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are a senior creative partner for this brand — operating simultaneously as Brand Strategist, Creative Director, Art Director & Graphic Designer, and Social Copywriter.

You are not a yes-machine. If a request would dilute the brand or produce a weak post, say so and propose a stronger alternative.

Brand guidelines are the constitution. Past posts are the case law. When they disagree, past posts reveal what the brand has evolved into — flag the tension and ask which direction to follow.

Before producing output, silently analyze: visual system (dominant colors with hex, type pairings, grid behavior, image treatment, white-space density, recurring motifs), voice & tone, composition patterns, audience signal.

Every design choice must be traceable to a guideline or past post. No filler, no generic marketing-speak, no emoji-stuffed captions unless the brand does that.

You are designing for an AI image generator (Gemini) that will render the COMPLETE creative — background, text, and all visual elements in a single image. Your output must be precise enough that the image generator produces a polished, production-ready Instagram post.`;

export const DIRECTION_OUTPUT_SCHEMA = `Respond with a single JSON object (no markdown fences):
{
  "concept": "2-3 sentences: the idea, why it fits the brand, what makes it scroll-stopping",
  "format": "static_4x5",
  "designDirection": {
    "layout": "Precise layout description. Example: 'Top 25%: headline text left-aligned on solid color block. Middle 50%: full-bleed visual/photography. Bottom 25%: subtext + CTA on semi-transparent overlay.'",
    "composition": "grid|centered|asymmetric|split-screen|full-bleed-text|minimal",
    "palette": [{ "hex": "#XXXXXX", "role": "background|primary-text|accent|highlight|overlay" }],
    "typography": "Specific type direction. Example: 'Headline: bold condensed sans-serif, 72pt equivalent, all-caps, tight tracking. Body: regular weight, 24pt, sentence case. CTA: medium weight, 20pt, inside rounded pill button.'",
    "imagery": "Visual scene description — what the background/photography depicts",
    "textPlacement": {
      "headline": { "zone": "top-third|center|bottom-third", "alignment": "left|center|right", "maxWidth": "80%|60%|full" },
      "body": { "zone": "center|below-headline", "alignment": "left|center", "maxWidth": "70%|80%" },
      "cta": { "zone": "bottom-quarter", "style": "pill-button|text-link|banner", "alignment": "center|left" }
    },
    "motifs": ["recurring visual elements from the brand"],
    "contrast": "How to ensure text readability — e.g., 'dark overlay at 60% opacity behind text zones' or 'solid color block for text area' or 'text shadow + high contrast colors'"
  },
  "copy": {
    "onImage": [
      { "text": "exact headline text", "role": "headline", "position": "top|center|bottom", "size": "xlarge|large|medium|small", "weight": "bold|semibold|regular", "color": "#FFFFFF or 'brand-primary'" },
      { "text": "supporting text", "role": "body", "position": "below-headline|center", "size": "medium|small", "weight": "regular|light", "color": "#CCCCCC or 'brand-secondary'" },
      { "text": "CTA text", "role": "cta", "position": "bottom", "size": "medium", "weight": "semibold", "color": "#FFFFFF", "background": "#E8464A or 'brand-accent'" }
    ],
    "caption": "full Instagram caption in brand voice",
    "cta": "call to action text for the image",
    "hashtags": ["no_hash_prefix"]
  },
  "assets": {
    "logo": { "position": "bottom-right|bottom-left|top-right|top-left", "size": "small|medium" },
    "locked": [{ "text": "text that must appear verbatim", "position": "bottom|top", "style": "small|legal" }]
  },
  "whyThisWorks": ["bullet 1 connecting choice to brand reference", "bullet 2"],
  "imageModelPrompt": "The COMPLETE visual brief for the image generator. This is the most important field — it must be specific enough to produce a finished Instagram post. Structure it as: SCENE (what the visual depicts), PALETTE (exact hex codes and where each is used), COMPOSITION (layout grid — what goes where), TEXT (exact text with sizes and positions), TYPOGRAPHY (style, weight, alignment), CONTRAST (how text stays readable). Example: 'Dark premium background in brand charcoal (#1A1A1A) with subtle diagonal gradient to (#2A2A3A). Top 30%: bold headline text in white (#FFFFFF), all-caps condensed sans-serif, left-aligned with generous left margin. Center: abstract geometric shapes in brand orange (#E8833A) — thin intersecting lines creating depth. Bottom 20%: supporting text in light grey (#9A9A9A), regular weight, followed by a rounded pill CTA button in brand orange with white text. Overall mood: sophisticated, minimal, high-contrast. Negative space: 40%.'"
}`;

export interface CreativeDirection {
  concept: string;
  format: string;
  designDirection: {
    layout: string;
    composition?: string;
    palette: { hex: string; role: string }[];
    typography: string;
    imagery: string;
    textPlacement?: {
      headline?: { zone: string; alignment: string; maxWidth: string };
      body?: { zone: string; alignment: string; maxWidth: string };
      cta?: { zone: string; style: string; alignment: string };
    };
    motifs: string[];
    contrast?: string;
  };
  copy: {
    onImage: { text: string; role?: string; position: string; size?: string; weight?: string; color?: string; background?: string; lock?: boolean }[];
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
