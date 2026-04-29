import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface QCFix {
  type: 'add_contrast_backing' | 'adjust_exposure' | 'add_vignette' | 'sharpen_region';
  region?: string;
  opacity?: number;
  delta?: number;
}

export interface QCReport {
  verdict: 'ship' | 'fix' | 'reject';
  textLegible: boolean;
  logoOk: boolean;
  paletteOk: boolean;
  safeZoneOk: boolean;
  issues: string[];
  fixes: QCFix[];
  rejectReason: string;
  passed: boolean;
}

/**
 * Three-bucket QC triage using Claude Haiku vision.
 * SHIP → proceed. FIX → apply Sharp post-processing (free). REJECT → one retry (capped).
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
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: imageMimeType as 'image/png' | 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: `Review this Instagram creative (4:5) and triage:

SHIP — looks good. Text crisp, colors match, composition clean.

FIX — minor issues fixable with post-processing (prefer this over reject):
- Low text contrast → {"type":"add_contrast_backing","region":"lower_third","opacity":0.4}
- Too bright/dark area → {"type":"adjust_exposure","region":"center","delta":-0.2}
- Lacks focus → {"type":"add_vignette"}
- Slightly soft → {"type":"sharpen_region"}
Regions: upper_third, lower_third, center, full, upper_left, upper_right, lower_left, lower_right

REJECT — only for unfixable: garbled text, wrong palette entirely, severe artifacts, broken composition.

Expected palette: ${expectedPalette.join(', ')}
Logo expected: ${expectedLogoPosition}

JSON only:
{"verdict":"ship|fix|reject","textLegible":bool,"logoOk":bool,"paletteOk":bool,"safeZoneOk":bool,"issues":["..."],"fixes":[...],"rejectReason":"if reject"}

PREFER fix over reject — post-processing is free.`,
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
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

    return {
      verdict: parsed.verdict || 'ship',
      textLegible: parsed.textLegible ?? true,
      logoOk: parsed.logoOk ?? true,
      paletteOk: parsed.paletteOk ?? true,
      safeZoneOk: parsed.safeZoneOk ?? true,
      issues: parsed.issues || [],
      fixes: parsed.fixes || [],
      rejectReason: parsed.rejectReason || '',
      passed: parsed.verdict === 'ship' || parsed.verdict === 'fix',
    };
  } catch {
    return {
      verdict: 'ship', textLegible: true, logoOk: true, paletteOk: true, safeZoneOk: true,
      issues: ['QC parse failed'], fixes: [], rejectReason: '', passed: true,
    };
  }
}
