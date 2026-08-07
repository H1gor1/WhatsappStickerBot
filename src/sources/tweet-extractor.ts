import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const env = loadEnv();

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function getSyndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Falha ao baixar: ${res.status}`);
  }
  const fileStream = createWriteStream(destPath);
  await pipeline(res.body as any, fileStream);
}

function detectMediaType(filePath: string): 'image' | 'video' | 'gif' {
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) return 'video';
  if (['.gif'].includes(ext)) return 'gif';
  return 'image';
}

async function tryImageFallback(url: string, outputBasePath: string): Promise<string> {
  const tweetId = extractTweetId(url);
  if (!tweetId) throw new Error('Não foi possível extrair o ID do tweet');

  const token = getSyndicationToken(tweetId);
  const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`;

  const res = await fetch(syndicationUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) {
    throw new Error(`Syndication API retornou ${res.status}`);
  }

  const data = await res.json() as any;
  const media = data?.mediaDetails?.[0];
  if (!media?.media_url_https) {
    throw new Error('Nenhuma mídia encontrada no tweet');
  }

  const imageUrl = `${media.media_url_https}?name=orig`;
  const destPath = `${outputBasePath}.jpg`;
  await downloadFile(imageUrl, destPath);

  logger.info({ destPath }, 'Imagem do tweet baixada via syndication API');
  return destPath;
}

export async function processTweetLink(
  url: string,
  requestId: string
): Promise<{ filePath: string; mediaType: 'image' | 'video' | 'gif' }> {
  const outputDir = path.join(env.STORAGE_PATH, 'tweets');
  await fs.mkdir(outputDir, { recursive: true });
  const outputBase = path.join(outputDir, requestId);

  logger.info({ url }, 'Baixando mídia do tweet');

  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '-o', `${outputBase}.%(ext)s`,
      '--no-playlist',
      '--print', 'after_move:filepath',
      url,
    ], { timeout: 60000 });

    const filePath = stdout.trim();
    if (!filePath) throw new Error('yt-dlp retornou caminho vazio');

    await fs.access(filePath);

    const mediaType = detectMediaType(filePath);
    logger.info({ filePath, mediaType }, 'Mídia do tweet baixada via yt-dlp');
    return { filePath, mediaType };
  } catch (error: any) {
    const stderr = error?.stderr ?? '';
    if (stderr.includes('No video could be found') || stderr.includes('no video')) {
      try {
        const fallbackPath = await tryImageFallback(url, outputBase);
        return { filePath: fallbackPath, mediaType: 'image' };
      } catch (fallbackError) {
        logger.error({ error: fallbackError, url }, 'Fallback de imagem falhou');
        throw new Error('Não foi possível baixar a mídia do tweet. Verifique se o link é válido.');
      }
    }
    logger.error({ error, url }, 'Erro ao baixar tweet');
    throw new Error('Não foi possível baixar a mídia do tweet. Verifique se o link é válido e acessível.');
  }
}
