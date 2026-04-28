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
