import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { loadAuthState } from './auth-state.js';
import { handleMessage } from './message-handler.js';
import { logger } from '../utils/logger.js';

let sock: WASocket | null = null;
let qrCode: string | null = null;
let connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'qr' = 'disconnected';
let connectedNumber: string | null = null;

function getStatusCodeFromBoom(error: unknown): number {
  if (error && typeof error === 'object' && 'output' in error) {
    const boom = error as { output?: { statusCode?: number } };
    return boom.output?.statusCode ?? 0;
  }
  if (error instanceof Error) {
    return 0;
  }
  return 0;
}

async function onConnectionUpdate(update: Partial<ConnectionState>) {
  if (update.qr) {
    qrCode = update.qr;
    connectionStatus = 'qr';
    logger.info('QR Code recebido');
  }

  if (update.connection === 'open') {
    connectionStatus = 'connected';
    qrCode = null;
    const user = sock?.user;
    if (user?.id) {
      connectedNumber = user.id.split(':')[0].split('@')[0];
    }
    logger.info({ number: connectedNumber }, 'WhatsApp conectado');
  }

  if (update.connection === 'close') {
    connectionStatus = 'disconnected';
    connectedNumber = null;
    const statusCode = getStatusCodeFromBoom(update.lastDisconnect?.error);
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    logger.warn({ statusCode }, 'WhatsApp desconectado');

    if (shouldReconnect) {
      setTimeout(() => {
        startConnection().catch((err) =>
          logger.error({ err }, 'Falha ao reconectar WhatsApp')
        );
      }, 5000);
    } else {
      logger.info('Sessão deslogada. QR code será necessário.');
    }
  }
}

export async function startConnection(): Promise<WASocket> {
  const { state, saveCreds } = await loadAuthState();
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = 'connecting';

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('connection.update', onConnectionUpdate);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      await handleMessage(sock!, msg);
    }
  });

  return sock;
}

export function getSocket(): WASocket | null {
  return sock;
}

export function getConnectionStatus() {
  return { status: connectionStatus, qrCode, connectedNumber };
}
