import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { logger } from '../utils/logger.js';
import { findOrCreateContact } from '../db/repositories/contact.repository.js';
import { createStickerRequest, updateStickerStatus } from '../db/repositories/sticker.repository.js';
import { addToQueue } from '../queue/media-queue.js';
import { processTweetLink } from '../sources/tweet-extractor.js';
import { sendText } from './sender.js';
import { loadEnv } from '../config/env.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const env = loadEnv();

const TWEET_REGEX = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i;

export async function handleMessage(sock: WASocket, msg: WAMessage) {
  const key = msg.key;
  const remoteJid = key.remoteJid;

  if (!remoteJid || remoteJid === 'status@broadcast') return;
  if (remoteJid.includes('@g.us')) return;
  if (key.fromMe) return;

  const messageContent = msg.message;
  if (!messageContent) return;

  const jid = remoteJid as string;
  const pushName = msg.pushName ?? undefined;

  if (messageContent.conversation || messageContent.extendedTextMessage) {
    const text =
      messageContent.conversation ||
      messageContent.extendedTextMessage?.text ||
      '';

    const tweetMatch = text.match(TWEET_REGEX);
    if (tweetMatch) {
      await handleTweetLink(sock, jid, text, pushName);
      return;
    }
  }

  if (
    messageContent.imageMessage ||
    messageContent.videoMessage ||
    messageContent.stickerMessage ||
    messageContent.documentMessage
  ) {
    await handleMediaMessage(sock, msg, jid, pushName);
    return;
  }
}

async function handleTweetLink(sock: WASocket, jid: string, url: string, pushName?: string) {
  logger.info({ jid, url }, 'Link de tweet detectado');

  const contact = await findOrCreateContact(jid, pushName);
  const stickerReq = await createStickerRequest({
    contactId: contact.id,
    mediaType: 'VIDEO',
    source: 'TWEET_LINK',
    sourceUrl: url,
  });

  await sendText(sock, jid, '⏳ Baixando mídia do tweet...');

  try {
    const result = await processTweetLink(url, stickerReq.id);

    await updateStickerStatus(stickerReq.id, 'PENDING', { originalPath: result.filePath });

    await addToQueue(stickerReq.id, jid, result.mediaType, result.filePath);

    logger.info({ stickerId: stickerReq.id }, 'Mídia do tweet enfileirada');
  } catch (error) {
    logger.error({ error, stickerId: stickerReq.id }, 'Erro ao baixar tweet');
    await updateStickerStatus(stickerReq.id, 'FAILED', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    await sendText(sock, jid, '❌ Não foi possível baixar a mídia do tweet. Verifique se o link é válido.');
  }
}

async function handleMediaMessage(
  sock: WASocket,
  msg: WAMessage,
  jid: string,
  pushName?: string
) {
  const messageContent = msg.message!;
  let mediaType: 'IMAGE' | 'VIDEO' | 'GIF';
  const isGif =
    (messageContent.videoMessage as Record<string, unknown>)?.gifPlayback === true;

  if (messageContent.imageMessage) {
    mediaType = 'IMAGE';
  } else if (isGif) {
    mediaType = 'GIF';
  } else {
    mediaType = 'VIDEO';
  }

  logger.info({ jid, mediaType }, 'Mídia recebida');

  const contact = await findOrCreateContact(jid, pushName);
  const stickerReq = await createStickerRequest({
    contactId: contact.id,
    mediaType,
    source: 'DIRECT_UPLOAD',
  });

  await sendText(sock, jid, '⏳ Processando sua figurinha...');

  try {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: pino({ level: 'silent' }),
        reuploadRequest: async (m) => m,
      }
    ) as Buffer;

    const ext = mediaType === 'IMAGE' ? '.jpg' : '.mp4';
    const filePath = path.join(env.STORAGE_PATH, 'uploads', `${stickerReq.id}_original${ext}`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    await updateStickerStatus(stickerReq.id, 'PENDING', { originalPath: filePath });
    await addToQueue(stickerReq.id, jid, mediaType, filePath);

    logger.info({ stickerId: stickerReq.id }, 'Mídia enfileirada');
  } catch (error) {
    logger.error({ error, stickerId: stickerReq.id }, 'Erro ao processar mídia');
    await updateStickerStatus(stickerReq.id, 'FAILED', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    await sendText(sock, jid, '❌ Erro ao processar sua mídia. Tente novamente.');
  }
}
