/**
 * Post-processing fixes using Sharp — CPU only, zero API cost.
 * Applied when QC returns verdict: "fix" with specific fix instructions.
 */
import sharp from 'sharp';

export interface QCFix {
  type: 'add_contrast_backing' | 'adjust_exposure' | 'add_vignette' | 'sharpen_region';
  region?: 'upper_third' | 'lower_third' | 'center' | 'full' | 'upper_left' | 'upper_right' | 'lower_left' | 'lower_right';
  opacity?: number;
  delta?: number;
}

/**
 * Apply programmatic fixes to the generated image.
 * Each fix is a lightweight Sharp operation — no API calls.
 */
export async function applyFixes(imageBase64: string, fixes: QCFix[]): Promise<string> {
  let img = sharp(Buffer.from(imageBase64, 'base64'));
  const metadata = await img.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1536;

  for (const fix of fixes) {
    switch (fix.type) {
      case 'add_contrast_backing':
        img = await addContrastBacking(img, width, height, fix.region || 'lower_third', fix.opacity || 0.4);
        break;
      case 'adjust_exposure':
        img = adjustExposure(img, fix.delta || 0);
        break;
      case 'add_vignette':
        img = await addVignette(img, width, height);
        break;
      case 'sharpen_region':
        img = img.sharpen({ sigma: 1.5 });
        break;
    }
  }

  const outputBuffer = await img.png().toBuffer();
  return outputBuffer.toString('base64');
}

/**
 * Add a semi-transparent dark rectangle over a region for text contrast.
 */
async function addContrastBacking(
  img: sharp.Sharp,
  width: number,
  height: number,
  region: string,
  opacity: number,
): Promise<sharp.Sharp> {
  const alpha = Math.round(opacity * 255);

  let top = 0;
  let left = 0;
  let regionWidth = width;
  let regionHeight = Math.round(height / 3);

  switch (region) {
    case 'upper_third':
      top = 0;
      regionHeight = Math.round(height / 3);
      break;
    case 'lower_third':
      top = Math.round(height * 2 / 3);
      regionHeight = Math.round(height / 3);
      break;
    case 'center':
      top = Math.round(height / 4);
      regionHeight = Math.round(height / 2);
      break;
    case 'upper_left':
      regionWidth = Math.round(width / 2);
      regionHeight = Math.round(height / 2);
      break;
    case 'upper_right':
      left = Math.round(width / 2);
      regionWidth = Math.round(width / 2);
      regionHeight = Math.round(height / 2);
      break;
    case 'lower_left':
      top = Math.round(height / 2);
      regionWidth = Math.round(width / 2);
      regionHeight = Math.round(height / 2);
      break;
    case 'lower_right':
      left = Math.round(width / 2);
      top = Math.round(height / 2);
      regionWidth = Math.round(width / 2);
      regionHeight = Math.round(height / 2);
      break;
    case 'full':
      regionHeight = height;
      break;
  }

  // Create a dark overlay
  const overlay = await sharp({
    create: {
      width: regionWidth,
      height: regionHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha },
    },
  })
    .png()
    .toBuffer();

  return sharp(await img.toBuffer()).composite([
    { input: overlay, top, left, blend: 'over' },
  ]);
}

/**
 * Adjust overall exposure (brightness).
 * delta: negative = darker, positive = lighter. Range: -1 to 1.
 */
function adjustExposure(img: sharp.Sharp, delta: number): sharp.Sharp {
  // Clamp delta to reasonable range
  const d = Math.max(-0.5, Math.min(0.5, delta));
  const brightness = 1 + d;
  return img.modulate({ brightness });
}

/**
 * Add a subtle vignette effect to pull focus to center.
 */
async function addVignette(img: sharp.Sharp, width: number, height: number): Promise<sharp.Sharp> {
  // Create a radial gradient-like vignette using a dark frame overlay
  // Sharp doesn't have native vignette, so we approximate with a dark border composite
  const borderSize = Math.round(Math.min(width, height) * 0.15);
  const innerWidth = width - borderSize * 2;
  const innerHeight = height - borderSize * 2;

  if (innerWidth <= 0 || innerHeight <= 0) return img;

  // Create a transparent center with dark edges
  const vignette = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 80 },
    },
  })
    .composite([{
      input: await sharp({
        create: {
          width: innerWidth,
          height: innerHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).png().toBuffer(),
      top: borderSize,
      left: borderSize,
      blend: 'dest-out' as const,
    }])
    .png()
    .toBuffer();

  return sharp(await img.toBuffer()).composite([
    { input: vignette, blend: 'over' },
  ]);
}
