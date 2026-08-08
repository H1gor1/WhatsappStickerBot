import { processTweetLink } from '../sources/tweet-extractor.js';
import { logger } from '../utils/logger.js';
import { createReadStream } from 'node:fs';
import { statSync } from 'node:fs';

const DOWNLOAD_REGEX = /^(download|baixar)\s+(https?:\/\/\S+)/i;

function getSource(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '').toLowerCase();
    if (domain.includes('twitter.com') || domain.includes('x.com')) return 'TWITTER';
    if (domain.includes('instagram.com')) return 'INSTAGRAM';
    if (domain.includes('tiktok.com')) return 'TIKTOK';
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) return 'YOUTUBE';
    if (domain.includes('facebook.com') || domain.includes('fb.com')) return 'FACEBOOK';
    if (domain.includes('reddit.com')) return 'REDDIT';
    return domain.split('.')[0].toUpperCase();
  } catch {
    return 'UNKNOWN';
  }
}

export function isDownloadRequest(text: string): string | null {
  const match = text.trim().match(DOWNLOAD_REGEX);
  return match ? match[2] : null;
}

export async function handleDownload(
  jid: string,
  url: string,
  requestId: string
): Promise<{ filePath: string; mimeType: string; ext: string; mediaType: 'IMAGE' | 'VIDEO' | 'GIF'; source: string }> {
  logger.info({ jid, url }, 'Modo download ativado');

  const result = await processTweetLink(url, requestId);

  const stats = statSync(result.filePath);
  const sizeMB = stats.size / (1024 * 1024);
  logger.info({ filePath: result.filePath, sizeMB: sizeMB.toFixed(1), mediaType: result.mediaType }, 'Arquivo baixado');

  const mimeMap: Record<string, string> = {
    image: 'image/jpeg',
    video: 'video/mp4',
    gif: 'image/gif',
  };

  const extMap: Record<string, string> = {
    image: '.jpg',
    video: '.mp4',
    gif: '.gif',
  };

  return {
    filePath: result.filePath,
    mimeType: mimeMap[result.mediaType] || 'application/octet-stream',
    ext: extMap[result.mediaType] || '.bin',
    mediaType: result.mediaType === 'gif' ? 'GIF' : result.mediaType === 'video' ? 'VIDEO' : 'IMAGE',
    source: getSource(url),
  };
}
