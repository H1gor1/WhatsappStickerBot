import { Worker, type Job } from 'bullmq';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { updateStickerStatus } from '../db/repositories/sticker.repository.js';
import { convertImageToWebp } from '../media/convert-image.js';
import { convertVideoToWebp } from '../media/convert-video.js';
import { addStickerMetadata } from '../media/add-metadata.js';
import { getSocket } from '../whatsapp/connection.js';
import { sendSticker, sendText } from '../whatsapp/sender.js';
import type { MediaJobData } from './media-queue.js';

const env = loadEnv();

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
};

async function processMediaJob(job: Job<MediaJobData>) {
  const { stickerRequestId, jid, mediaType, inputPath } = job.data;

  logger.info({ stickerRequestId, mediaType }, 'Processando job de mídia');

  await updateStickerStatus(stickerRequestId, 'PROCESSING');

  try {
    await fs.access(inputPath);

    const outputDir = path.join(env.STORAGE_PATH, 'stickers');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${stickerRequestId}.webp`);

    if (mediaType === 'IMAGE') {
      await convertImageToWebp(inputPath, outputPath);
    } else if (mediaType === 'VIDEO' || mediaType === 'GIF') {
      await convertVideoToWebp(inputPath, outputPath, mediaType === 'GIF');
    } else {
      throw new Error(`Tipo de mídia inválido: ${mediaType}`);
    }

    const stickerBuffer = await addStickerMetadata(outputPath);

    const sock = getSocket();
    if (!sock) {
      throw new Error('Socket WhatsApp não disponível');
    }

    await sendSticker(sock, jid, stickerBuffer);

    await updateStickerStatus(stickerRequestId, 'DONE', {
      resultPath: outputPath,
      processedAt: new Date(),
    });

    try { await fs.unlink(inputPath); } catch {}

    logger.info({ stickerRequestId }, 'Sticker processado e enviado');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, stickerRequestId }, 'Erro ao processar job de mídia');

    await updateStickerStatus(stickerRequestId, 'FAILED', { errorMessage: errorMsg });

    const sock = getSocket();
    if (sock) {
      await sendText(sock, jid, `\u274C Erro ao gerar figurinha: ${errorMsg}`);
    }

    throw error;
  }
}

export function startMediaWorker() {
  const worker = new Worker<MediaJobData>(
    'media-processing',
    processMediaJob,
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job falhou');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job?.id }, 'Job concluído');
  });

  logger.info('Worker de mídia iniciado');
  return worker;
}
