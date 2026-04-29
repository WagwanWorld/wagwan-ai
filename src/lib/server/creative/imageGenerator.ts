import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  tokensUsed?: number;
}

/**
 * Build a structured design brief for Gemini from Claude's direction.
 * This is the core quality driver — the more specific the prompt,
 * the better Gemini's output.
 */
function buildDesignBrief(direction: CreativeDirection, brandPalette: string[], userOverride?: string): string {
  // If user edited the prompt, use it but still append the text hierarchy
  if (userOverride) {
    const textSection = buildTextHierarchy(direction);
    return `${userOverride}

${textSection}`;
  }

  const d = direction.designDirection;
  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);

  // Map palette roles to specific usage
  const colorMap = d.palette.reduce((acc, c) => { acc[c.role] = c.hex; return acc; }, {} as Record<string, string>);
  const bgColor = colorMap['background'] || palette[0] || '#1A1A1A';
  const textColor = colorMap['primary-text'] || colorMap['text'] || '#FFFFFF';
  const accentColor = colorMap['accent'] || colorMap['highlight'] || palette[1] || '#E8464A';

  const sections: string[] = [];

  // 0. DESIGN PHILOSOPHY — forces integrated composition
  sections.push(`YOU ARE DESIGNING A SINGLE, UNIFIED COMPOSITION — not layers.

The text, imagery, and visual elements must feel like they were designed together as ONE piece. The text is not "placed on top of" an image — it is an integral part of the visual design. Think of it like a magazine cover or a high-end brand campaign poster where typography and imagery are inseparable.

Approach this like a senior art director at a top agency (Pentagram, Collins, Sagmeister & Walsh) would — every pixel is intentional.`);

  // 1. CANVAS & BACKGROUND
  sections.push(`CANVAS: 4:5 portrait (1080×1350px). Instagram post.

VISUAL SCENE:
${d.imagery || direction.imageModelPrompt || 'Clean, minimal brand background'}
Primary background: ${bgColor}
${d.contrast || 'Ensure strong contrast between background and text. Use color blocking, gradients, or depth of field to create natural text zones — NOT opaque overlays pasted on top.'}`);

  // 2. COMPOSITION GRID
  const tp = d.textPlacement;
  sections.push(`COMPOSITION & LAYOUT:
Style: ${d.composition || 'balanced'}
${d.layout}
${tp ? `
- Headline zone: ${tp.headline?.zone || 'top-third'}, aligned ${tp.headline?.alignment || 'left'}, max width ${tp.headline?.maxWidth || '80%'}
- Body zone: ${tp.body?.zone || 'center'}, aligned ${tp.body?.alignment || 'left'}, max width ${tp.body?.maxWidth || '70%'}
- CTA zone: ${tp.cta?.zone || 'bottom-quarter'}, style: ${tp.cta?.style || 'pill-button'}, aligned ${tp.cta?.alignment || 'center'}` : ''}
- Logo space: reserved ${direction.assets.logo?.position || 'bottom-right'} corner (will be added separately)
- Negative space: maintain at least 30% — the design should breathe, not feel cramped`);

  // 3. TEXT HIERARCHY (the most critical part)
  sections.push(buildTextHierarchy(direction));

  // 4. TYPOGRAPHY — studio grade
  sections.push(`TYPOGRAPHY:
${d.typography || 'Clean modern sans-serif. Think Helvetica Neue, Inter, or DM Sans family.'}
- STUDIO GRADE text rendering — every letterform must be crisp, perfectly kerned, and anti-aliased
- Consistent baseline grid — all text blocks align to an invisible grid
- Type scale: headline is 3-4x larger than body. Body is 1.5x larger than fine print. Maintain this ratio strictly.
- Line height: headline 1.1em (tight), body 1.4em (readable), CTA 1.0em (compact)
- NEVER stretch, warp, or distort letterforms
- Text should feel like it was set in a professional layout tool, not auto-generated`);

  // 5. COLOR SYSTEM
  sections.push(`COLOR SYSTEM:
- Background: ${bgColor}
- Primary text: ${textColor}
- Accent / CTA: ${accentColor}
- Secondary text: ${colorMap['secondary'] || '#9A9AA0'}
- Full palette: ${palette.join(', ')}
Use the brand colors as the dominant visual identity — the final image should feel like it belongs to THIS brand's feed.`);

  // 6. VISUAL MOTIFS
  if (d.motifs?.length) {
    sections.push(`BRAND MOTIFS: ${d.motifs.join(', ')}
Incorporate these subtly — they should reinforce brand identity without dominating the composition.`);
  }

  // 7. STUDIO QUALITY STANDARD
  sections.push(`STUDIO QUALITY STANDARD — NON-NEGOTIABLE:

COMPOSITION:
- Golden ratio or rule-of-thirds alignment for all major elements
- Clear visual hierarchy: the eye should travel Headline → Visual → Body → CTA in that order
- Intentional whitespace — every gap between elements is a deliberate design choice, not leftover space
- Text and imagery must feel INTEGRATED — like one composition, not a photo with text pasted on top

VISUAL FIDELITY:
- Render quality equivalent to a Behance/Dribbble featured design post
- Subtle grain or texture if it matches the brand aesthetic — never flat/dead surfaces
- Color grading should feel cinematic and intentional, not default/unprocessed
- Lighting should have direction and purpose — soft gradients, not flat fills
- If using photography elements, they should feel editorial (styled, lit, composed) not stock

WHAT TO AVOID:
- Generic stock photo aesthetics (overly bright, no personality)
- Floating text boxes that look pasted onto a background
- Clipart-style graphics or cheap gradient backgrounds
- Text that fights with the visual instead of complementing it
- Unintentional visual clutter — every element must earn its place
- Cookie-cutter social media template look

FINAL CHECK: Would a creative director at a leading design agency approve this for a premium brand's feed? If not, it's not good enough.`);

  return sections.join('\n\n---\n\n');
}

/**
 * Build the text hierarchy section — tells Gemini exactly what text
 * to render, at what size, weight, color, and position.
 */
function buildTextHierarchy(direction: CreativeDirection): string {
  const textBlocks = direction.copy.onImage || [];
  if (textBlocks.length === 0 && !direction.copy.cta) {
    return 'TEXT: No on-image text — this is a visual-only post.';
  }

  const lines: string[] = ['TEXT HIERARCHY (render in this exact order of visual dominance):'];

  // Sort by role: headline first, then body, then CTA
  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];
    const role = block.role || (i === 0 ? 'headline' : 'body');
    const sizeMap: Record<string, string> = { xlarge: '~72pt, dominant', large: '~48pt, prominent', medium: '~28pt, supporting', small: '~18pt, subtle' };
    const size = sizeMap[block.size || 'large'] || sizeMap['medium'];

    lines.push(`
${(i + 1)}. [${role.toUpperCase()}] "${block.text}"
   Position: ${block.position || 'center'}
   Size: ${size}
   Weight: ${block.weight || (role === 'headline' ? 'bold' : 'regular')}
   Color: ${block.color || (role === 'headline' ? '#FFFFFF' : '#CCCCCC')}
   ${block.background ? `Background: ${block.background} (pill/block behind text)` : ''}`);
  }

  if (direction.copy.cta) {
    const ctaBlock = sorted.find(b => b.role === 'cta');
    if (!ctaBlock) {
      lines.push(`
${sorted.length + 1}. [CTA] "${direction.copy.cta}"
   Position: bottom-quarter, centered
   Style: rounded pill button or prominent banner
   Size: ~20pt, semibold
   Color: #FFFFFF on accent background
   Background: brand accent color as solid pill/button`);
    }
  }

  lines.push(`
CRITICAL TEXT RULES:
- Every character must be PERFECTLY legible — zero garbled, overlapping, or cut-off text
- Headline is the HERO — it should be the first thing the eye sees, commanding the composition
- Body text supports the headline — clearly smaller, secondary visual weight
- Text must feel DESIGNED INTO the composition — not floating on top of it. Use color blocking, bleed zones, or integrated backgrounds that make text feel architectural
- CTA is a distinct UI element (button/pill) — not just more text
- Text blocks must have clear breathing room between them (at least 24px equivalent)
- If text is over a busy background, add a semi-transparent dark overlay or solid color block behind it`);

  return lines.join('');
}

/**
 * Generate the complete Instagram creative via Gemini 2.5 Flash Image.
 */
export async function generateImage(
  direction: CreativeDirection,
  options?: {
    styleReferences?: Array<{ base64: string; mimeType: string; source?: 'moodboard' | 'brand-post' }>;
    aspectRatio?: string;
    brandPalette?: string[];
    userPromptOverride?: string;
  },
): Promise<ImageGenResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Style references — moodboard refs first (highest priority), then brand post refs
  if (options?.styleReferences?.length) {
    const moodboardRefs = options.styleReferences.filter(r => r.source === 'moodboard');
    const brandPostRefs = options.styleReferences.filter(r => r.source !== 'moodboard');

    if (moodboardRefs.length > 0) {
      contents.push({
        text: `MOODBOARD REFERENCES — this is the exact visual style, composition, and aesthetic to match. These are the creative director's chosen references for this brand. Study them carefully and replicate:
• The overall visual mood and tone
• Color grading, temperature, and palette feel
• Composition style and spatial arrangement
• Level of polish, texture, and finish
• Typography treatment and text-image relationships

These moodboard references take HIGHEST PRIORITY — the output must feel like it belongs in this aesthetic world:`,
      });
      for (const ref of moodboardRefs.slice(0, 4)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }

    if (brandPostRefs.length > 0) {
      contents.push({
        text: `BRAND POST REFERENCES — match the brand's color palette and identity from these existing posts. The new creative must feel like it belongs in this brand's feed:`,
      });
      for (const ref of brandPostRefs.slice(0, 3)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }

    // Fallback: if no source tags (legacy callers), use original generic label
    if (moodboardRefs.length === 0 && brandPostRefs.length === 0) {
      contents.push({
        text: `BRAND STYLE REFERENCES — study these existing posts carefully. Match their:
• Color grading and temperature
• Typography style and text treatment
• Composition patterns and layout approach
• Level of polish and sophistication
• Overall mood and aesthetic

The new creative must look like it belongs alongside these posts in the same feed:`,
      });
      for (const ref of options.styleReferences.slice(0, 3)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }
  }

  // The structured design brief
  const designBrief = buildDesignBrief(
    direction,
    options?.brandPalette || [],
    options?.userPromptOverride,
  );

  contents.push({ text: designBrief });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents,
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: (options?.aspectRatio || '4:5') as '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
        tokensUsed: response.usageMetadata?.totalTokenCount,
      };
    }
  }

  throw new Error('Image model returned no image');
}
