import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export async function convertVideoToWebp(
  inputPath: string,
  outputPath: string,
  _isGif: boolean
): Promise<void> {
  const baseArgs = [
    '-i', inputPath,
    '-f', 'webp',
    '-c:v', 'libwebp',
    '-lossless', '0',
    '-loop', '0',
    '-preset', 'default',
    '-an',
    '-y',
  ];

  const attempts: Array<{ size: string; fps: number; q: number; compression: number; duration: number }> = [
    { size: '512:512', fps: 15, q: 60, compression: 4, duration: 6 },
    { size: '512:512', fps: 10, q: 40, compression: 6, duration: 5 },
    { size: '256:256', fps: 8,  q: 30, compression: 6, duration: 4 },
  ];

  let lastSize = 0;

  for (const attempt of attempts) {
    const vf = `fps=${attempt.fps},scale=${attempt.size}:force_original_aspect_ratio=decrease,pad=${attempt.size}:(ow-iw)/2:(oh-ih)/2:color=0x000000@0x00,format=yuva420p`;

    const args = [
      ...baseArgs,
      '-vf', vf,
      '-compression_level', String(attempt.compression),
      '-q:v', String(attempt.q),
      '-t', String(attempt.duration),
      outputPath,
    ];

    await execFileAsync('ffmpeg', args);

    const stat = await fs.stat(outputPath);
    lastSize = stat.size;

    if (stat.size <= 500 * 1024) break;
  }

  logger.info({ inputPath, outputPath, sizeKB: (lastSize / 1024).toFixed(1) }, 'Vídeo convertido para WebP');
}
