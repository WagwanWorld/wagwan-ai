import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  tokensUsed?: number;
}

/**
 * Build the Gemini prompt from Claude's direction.
 *
 * KEY INSIGHT: We're asking Gemini to produce a DESIGNED COMPOSITION,
 * not a photo with text. The prompt reads like a design specification,
 * not a scene description.
 */
function buildDesignSpec(direction: CreativeDirection, brandPalette: string[], userOverride?: string): string {
  const d = direction.designDirection;
  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);

  // If user edited the prompt, use it but append text specs
  if (userOverride) {
    return `${userOverride}

${buildTextSpec(direction)}

OUTPUT STANDARD: This must look like a production-ready Instagram post designed by a senior designer at a top agency. Not a template. Not AI-looking. A crafted, intentional design where typography and layout are the design.`;
  }

  const colorMap = d.palette.reduce((acc, c) => { acc[c.role] = c.hex; return acc; }, {} as Record<string, string>);

  const sections: string[] = [];

  // THE CORE INSTRUCTION
  sections.push(`Design a production-ready Instagram post (4:5, 1080×1350px).

THIS IS A DESIGN SPECIFICATION — NOT A PHOTO REQUEST.
Study the moodboard references above carefully. Replicate their DESIGN LANGUAGE:
• Layout structure and spatial logic
• Typography treatment and text-image relationship
• Color blocking and field division
• Level of craft and intentionality
• Overall approach (typographic, graphic, editorial, mixed-media)

DO NOT default to stock photography with text overlaid. The moodboard defines the approach.`);

  // DESIGN APPROACH
  sections.push(`DESIGN APPROACH: ${d.approach || 'typographic'}

LAYOUT SPECIFICATION:
${d.layout}

${d.visualElements ? `GRAPHIC ELEMENTS:\n${d.visualElements}` : ''}
${d.imagery ? `IMAGERY (only if design calls for it):\n${d.imagery}` : ''}`);

  // COLOR SYSTEM
  sections.push(`COLOR SYSTEM:
${d.palette.map(c => `• ${c.role}: ${c.hex}`).join('\n')}
${palette.length > d.palette.length ? `\nFull brand palette: ${palette.join(', ')}` : ''}

Apply these colors architecturally — as large color fields, type colors, and accent elements. Not as tints or overlays on photos.`);

  // TEXT — the most important part
  sections.push(buildTextSpec(direction));

  // TYPOGRAPHY
  sections.push(`TYPOGRAPHY:
${d.typography || 'Clean grotesque sans-serif. Heavy weight for headlines, regular for body.'}

TYPOGRAPHIC RULES:
• Every letterform must be crisp, perfectly kerned, and properly anti-aliased
• Headline type should be LARGE and COMMANDING — it's the focal point of the design
• Maintain strict baseline alignment and consistent spacing
• Type size contrast: headline should be 3-4x larger than body text
• The typography itself should create visual interest — weight, size, and spatial contrast`);

  // CONTRAST & READABILITY
  sections.push(`READABILITY:
${d.contrast || 'Achieve contrast through design decisions (color fields, spatial separation) — NOT through transparency overlays or drop shadows.'}

Text must be instantly readable at phone screen size. If you need to add a background for text — make it a DESIGN ELEMENT (a bold color block), not a "text box overlay."`);

  // QUALITY BAR
  sections.push(`QUALITY BAR:
This design must look like it belongs on a Behance "Featured" project or in a design agency's portfolio.

MANDATORY:
• Clean, precise execution — pixel-perfect alignment
• Intentional negative space (at least 25% of canvas)
• Clear visual hierarchy: eye goes Headline → Supporting text → CTA
• Every element is positioned with purpose, not randomly
• The overall feel should be CONFIDENT and REFINED

ABSOLUTELY NOT:
• Canva template aesthetics
• Stock photo with floating text boxes
• Busy, cluttered composition
• Generic gradients or effects
• Anything that looks auto-generated or template-driven
• Text that fights the background for attention

Reserve space in the ${direction.assets.logo?.position || 'bottom-right'} for a logo (added separately).`);

  return sections.join('\n\n---\n\n');
}

/**
 * Build the text specification — tells Gemini exactly what text to render.
 */
function buildTextSpec(direction: CreativeDirection): string {
  const textBlocks = direction.copy.onImage || [];
  if (textBlocks.length === 0 && !direction.copy.cta) {
    return 'TEXT: No on-image text.';
  }

  const lines: string[] = ['TEXT TO RENDER (in order of visual hierarchy):'];

  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];
    const role = block.role || (i === 0 ? 'headline' : 'body');

    lines.push(`
${i + 1}. [${role.toUpperCase()}] "${block.text}"
   Zone: ${block.position || 'center'}
   Size: ${role === 'headline' ? 'DOMINANT — largest text on the canvas, commands attention' : role === 'cta' ? 'Medium, inside a distinct button/pill element' : 'Supporting — clearly secondary to the headline'}
   Weight: ${block.weight || (role === 'headline' ? 'heavy/black' : 'regular')}
   Color: ${block.color || (role === 'headline' ? 'primary text color from palette' : 'secondary text color from palette')}`);
  }

  if (direction.copy.cta && !sorted.find(b => b.role === 'cta')) {
    lines.push(`
${sorted.length + 1}. [CTA] "${direction.copy.cta}"
   Zone: bottom section
   Style: pill button or distinct call-to-action element — NOT just more body text
   Color: accent color background with contrasting text`);
  }

  lines.push(`
TEXT RENDERING RULES:
• Every character PERFECTLY formed — zero garbled, blurry, or broken letterforms
• The headline IS the design — give it visual weight and spatial dominance
• Text blocks have generous breathing room between them
• Text must be DESIGNED INTO the layout — part of the composition grid, not floating on top`);

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

  // MOODBOARD REFERENCES — highest priority, define the design language
  if (options?.styleReferences?.length) {
    const moodboardRefs = options.styleReferences.filter(r => r.source === 'moodboard');
    const brandPostRefs = options.styleReferences.filter(r => r.source !== 'moodboard');

    if (moodboardRefs.length > 0) {
      contents.push({
        text: `MOODBOARD — these define the design language. Study them carefully and replicate their:
• Overall design approach (typographic, graphic, editorial, photographic)
• Layout structure and spatial divisions
• Typography treatment — how text is sized, weighted, and positioned
• Color application — fields, blocks, accents
• Level of craft and sophistication
• How text and visual elements integrate as one composition

MATCH THIS LEVEL OF QUALITY AND THIS DESIGN APPROACH:`,
      });
      for (const ref of moodboardRefs.slice(0, 4)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }

    if (brandPostRefs.length > 0) {
      contents.push({
        text: `BRAND IDENTITY REFERENCES — match this brand's color palette and visual identity:`,
      });
      for (const ref of brandPostRefs.slice(0, 2)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }
  }

  // The design specification
  const designSpec = buildDesignSpec(
    direction,
    options?.brandPalette || [],
    options?.userPromptOverride,
  );

  contents.push({ text: designSpec });

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
