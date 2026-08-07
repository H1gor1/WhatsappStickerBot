import { Queue } from 'bullmq';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

export interface MediaJobData {
  stickerRequestId: string;
  jid: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF';
  inputPath: string;
}

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
};

export const mediaQueue = new Queue<MediaJobData>('media-processing', { connection });

export async function addToQueue(
  stickerRequestId: string,
  jid: string,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | 'image' | 'video' | 'gif',
  inputPath: string
) {
  const normalizedType = mediaType.toUpperCase() as 'IMAGE' | 'VIDEO' | 'GIF';
  await mediaQueue.add('process-media', {
    stickerRequestId,
    jid,
    mediaType: normalizedType,
    inputPath,
  });
}
