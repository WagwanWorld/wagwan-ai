import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  model: string;
  quality: string;
}

/**
 * Build the prompt for GPT from Claude's direction.
 *
 * The prompt has 4 sections:
 * 1. Moodboard translation (from Claude's analysis)
 * 2. The design brief (from Claude's imageModelPrompt)
 * 3. Text rendering instructions
 * 4. Self-critique checklist (GPT reviews before rendering)
 */
function buildPrompt(direction: CreativeDirection, brandPalette: string[], userOverride?: string, options?: { logoUrl?: string }): string {
  const d = direction.designDirection;
  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);

  // Section 1: Moodboard analysis (Claude's deep reading of the references)
  const moodboardSection = direction.moodboardAnalysis
    ? `MOODBOARD ANALYSIS (from creative director's study of the references):\n${direction.moodboardAnalysis}\n\nYou can also see the moodboard images attached above. Match their design language EXACTLY — not approximately, not "inspired by", but at the SAME level of craft and specificity.\n`
    : '';

  // Section 2: The design brief
  const designBrief = userOverride || direction.imageModelPrompt || '';

  // Section 3: Text to render
  const textBlocks = direction.copy.onImage || [];
  const textLines: string[] = [];
  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (const block of sorted) {
    const role = block.role || 'body';
    textLines.push(`"${block.text}" — ${role.toUpperCase()}, ${block.weight || (role === 'headline' ? 'heavy/black' : 'regular')}, ${block.color || '#FFFFFF'}`);
  }
  if (direction.copy.cta && !sorted.find(b => b.role === 'cta')) {
    textLines.push(`"${direction.copy.cta}" — CTA, button/pill element, accent color`);
  }

  // Section 4: Quality standard + design pattern
  const patternDesc: Record<string, string> = {
    'hero-type': 'The headline IS the design — massive type fills 60-70% of the frame',
    'split-canvas': 'Bold color division creating two distinct zones with type in each',
    'editorial': 'Magazine-quality layout with sophisticated type overlay',
    'stat-data': 'A single number/metric dominates, everything else is context',
    'minimal': 'Maximum whitespace, small precise type, stark confidence',
    'collage': 'Layered elements, mixed textures, controlled chaos',
    'poster': 'Full-bleed color with bold typographic hierarchy, street poster energy',
  };
  const pattern = direction.designPattern || 'poster';

  // Visual elements
  const visualElements = d.visualElements || '';

  // Structured text hierarchy from copy decomposition + creative direction
  const th = direction.textHierarchy;
  const textSection = th ? `
TEXT TO RENDER (these are the EXACT words — render them precisely):
${th.hook?.text ? `→ HOOK (dominant): "${th.hook.text}" — ${th.hook.treatment}` : ''}
${th.body?.text ? `→ BODY (supporting): "${th.body.text}" — ${th.body.treatment}` : ''}
${th.cta?.text ? `→ CTA (action): "${th.cta.text}" — ${th.cta.treatment}` : ''}
` : `TEXT TO RENDER:\n${textLines.join('\n')}`;

  // Typography direction
  const typoDir = direction.typography;
  const typoSection = typoDir
    ? `TYPOGRAPHY: ${typoDir.character}. Mood: ${typoDir.mood}.`
    : `TYPE: ${d.typography || 'Bold sans-serif headlines, light body copy'}`;

  // Logo
  const logoSection = options?.logoUrl
    ? `LOGO: Place the provided brand logo in the ${direction.logoPlacement?.position || direction.assets.logo?.position || 'bottom-right'} corner. ${direction.logoPlacement?.size || 'Small'}, clean, unmodified.`
    : `LOGO: Leave space in ${direction.logoPlacement?.position || direction.assets.logo?.position || 'bottom-right'} for a logo.`;

  // Negative constraints
  const constraints = direction.constraints || [];
  const constraintSection = constraints.length > 0
    ? `\nAVOID:\n${constraints.map(c => `✗ ${c}`).join('\n')}`
    : '';

  return `Create a production-ready Instagram post (4:5 portrait, 1080×1350).

${moodboardSection}
DESIGN PATTERN: ${patternDesc[pattern] || patternDesc['poster']}

${designBrief}

COLORS: ${d.palette.map(c => `${c.hex} (${c.feel || c.role})`).join(' | ')}

${visualElements ? `VISUAL ELEMENTS: ${visualElements}\nIntegrate these as native brand elements — not afterthoughts.\n` : ''}

${textSection}

${typoSection}

${logoSection}
${constraintSection}

═══ SELF-CRITIQUE (check before rendering) ═══
1. BRAND FIT — looks native to this brand's feed and moodboard?
2. TEXT — every character crisp, perfectly formed, zero garbled letters?
3. HIERARCHY — instantly clear: hook first, body second, CTA third?
4. INTEGRATION — text is PART of the design, not pasted on top?
5. SCROLL-STOP — would a real person pause for this? Not a template?
6. RESTRAINT — every element earns its place?

Only render when all 6 pass.`;
}

/**
 * Generate a complete Instagram creative using OpenAI Responses API.
 * GPT-4o with image_generation tool — supports input images for style reference.
 */
export async function generateImage(
  direction: CreativeDirection,
  options?: {
    styleReferences?: Array<{ base64: string; mimeType: string; source?: 'moodboard' | 'brand-post' }>;
    aspectRatio?: string;
    brandPalette?: string[];
    userPromptOverride?: string;
    quality?: 'low' | 'medium' | 'high';
    logoUrl?: string;
  },
): Promise<ImageGenResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const client = new OpenAI({ apiKey });

  const prompt = buildPrompt(
    direction,
    options?.brandPalette || [],
    options?.userPromptOverride,
    { logoUrl: options?.logoUrl },
  );

  const quality = options?.quality || 'high';

  // Build content blocks with reference images
  const contentBlocks: Array<{ type: string; text?: string; image_url?: string }> = [];

  const supportedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const refs = (options?.styleReferences || []).filter(r => supportedMimes.includes(r.mimeType));
  const moodboardRefs = refs.filter(r => r.source === 'moodboard');
  const brandRefs = refs.filter(r => r.source === 'brand-post');

  if (moodboardRefs.length > 0) {
    contentBlocks.push({
      type: 'input_text',
      text: 'MOODBOARD REFERENCES — these define the design world. Study the design patterns, color architecture, typography treatment, and compositional structure. Your output must match this level of craft:',
    });
    for (const ref of moodboardRefs.slice(0, 3)) {
      contentBlocks.push({
        type: 'input_image',
        image_url: `data:${ref.mimeType};base64,${ref.base64}`,
      });
    }
  }

  if (brandRefs.length > 0) {
    contentBlocks.push({
      type: 'input_text',
      text: 'BRAND IDENTITY — match this brand\'s color palette and visual language:',
    });
    for (const ref of brandRefs.slice(0, 2)) {
      contentBlocks.push({
        type: 'input_image',
        image_url: `data:${ref.mimeType};base64,${ref.base64}`,
      });
    }
  }

  // Pass logo image if available AND in a supported raster format
  // OpenAI only accepts: image/jpeg, image/png, image/gif, image/webp — NOT SVG
  if (options?.logoUrl) {
    try {
      const logoRes = await fetch(options.logoUrl);
      if (logoRes.ok) {
        const logoMime = logoRes.headers.get('content-type') || '';
        const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (supportedFormats.includes(logoMime)) {
          const buffer = await logoRes.arrayBuffer();
          const logoBase64 = Buffer.from(buffer).toString('base64');
          contentBlocks.push({
            type: 'input_text',
            text: `BRAND LOGO — place this EXACTLY as-is in the ${direction.logoPlacement?.position || direction.assets.logo?.position || 'bottom-right'} corner. Small, subtle. Do NOT redraw or modify:`,
          });
          contentBlocks.push({
            type: 'input_image',
            image_url: `data:${logoMime};base64,${logoBase64}`,
          });
        }
        // If SVG or unsupported format, skip image but keep text instruction
      }
    } catch { /* no logo — prompt still tells GPT to leave space */ }
  }

  contentBlocks.push({ type: 'input_text', text: prompt });

  // Use Responses API with image_generation tool
  const response = await (client as any).responses.create({
    model: 'gpt-4o',
    input: [{
      role: 'user',
      content: contentBlocks,
    }],
    tools: [{
      type: 'image_generation',
      quality,
      size: '1024x1536',
    }],
  });

  // Extract generated image
  const outputs = response.output || [];
  const imageOutput = outputs.find(
    (o: Record<string, unknown>) => o.type === 'image_generation_call'
  ) as { type: string; result: string } | undefined;

  if (!imageOutput?.result) {
    throw new Error('OpenAI returned no image');
  }

  return {
    base64: imageOutput.result,
    mimeType: 'image/png',
    model: 'gpt-image-1',
    quality,
  };
}
