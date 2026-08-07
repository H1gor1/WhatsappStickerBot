import sharp from 'sharp';
import fs from 'node:fs/promises';
import { logger } from '../utils/logger.js';

export async function convertImageToWebp(inputPath: string, outputPath: string): Promise<void> {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image dimensions');
  }

  let quality = 80;
  let resized = image.clone().ensureAlpha().resize({
    width: 512,
    height: 512,
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  });

  let webp = await resized.webp({ quality, alphaQuality: 100 }).toBuffer();

  while (webp.length > 500 * 1024 && quality > 10) {
    quality -= 10;
    webp = await resized.webp({ quality, alphaQuality: 100 }).toBuffer();
  }

  if (webp.length > 500 * 1024) {
    resized = image.clone().ensureAlpha().resize({ width: 256, height: 256, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } });
    quality = 60;
    webp = await resized.webp({ quality, alphaQuality: 100 }).toBuffer();
  }

  await fs.writeFile(outputPath, webp);
  logger.info({ inputPath, outputPath, sizeKB: (webp.length / 1024).toFixed(1) }, 'Imagem convertida para WebP');
}
