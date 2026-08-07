import type { WASocket } from '@whiskeysockets/baileys';
import { logger } from '../utils/logger.js';

export async function sendSticker(sock: WASocket, jid: string, stickerBuffer: Buffer) {
  try {
    await sock.sendMessage(jid, {
      sticker: stickerBuffer,
    });
    logger.info({ jid }, 'Sticker enviado');
  } catch (error) {
    logger.error({ error, jid }, 'Erro ao enviar sticker');
    throw error;
  }
}

export async function sendText(sock: WASocket, jid: string, text: string) {
  try {
    await sock.sendMessage(jid, { text });
  } catch (error) {
    logger.error({ error, jid }, 'Erro ao enviar texto');
  }
}
