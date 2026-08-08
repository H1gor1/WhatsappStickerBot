import QRCode from 'qrcode';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConnectionStatus, getSocket } from '../whatsapp/connection.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const env = loadEnv();

export function getStatus(): 'connected' | 'awaiting_qr' | 'disconnected' {
  const { status, qrCode } = getConnectionStatus();
  if (status === 'connected') return 'connected';
  if (qrCode) return 'awaiting_qr';
  return 'disconnected';
}

export function getConnectedNumber(): string | null {
  const { connectedNumber } = getConnectionStatus();
  return connectedNumber;
}

export async function getQrAsBase64Png(): Promise<string | null> {
  const { qrCode } = getConnectionStatus();
  if (!qrCode) return null;

  try {
    return await QRCode.toDataURL(qrCode);
  } catch (error) {
    logger.error({ error }, 'Erro ao gerar QR code PNG');
    return null;
  }
}

export async function switchNumber(): Promise<void> {
  const sessionsPath = env.SESSIONS_PATH;

  try {
    const sock = getSocket();
    if (sock) {
      sock.end(new Error('switch-number'));
    }
  } catch {}

  try {
    const files = await fs.readdir(sessionsPath);
    for (const file of files) {
      await fs.unlink(path.join(sessionsPath, file));
    }
  } catch {
    // pasta não existe ainda
  }

  logger.info('Sessão limpa para troca de número');
}

export async function logout(): Promise<void> {
  try {
    const sock = getSocket();
    if (sock) {
      sock.end(new Error('logout'));
    }
  } catch {}
  logger.info('Bot desconectado (logout)');
}
