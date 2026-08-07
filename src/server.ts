import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { loadEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { startConnection, getSocket } from './whatsapp/connection.js';
import { startMediaWorker } from './queue/media-worker.js';
import { prisma } from './db/client.js';
import { healthRoutes } from './routes/health.js';
import { statusRoutes } from './routes/status.js';
import { statsRoutes } from './routes/stats.js';

const env = loadEnv();

async function main() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  await app.register(healthRoutes);
  await app.register(statusRoutes);
  await app.register(statsRoutes);

  app.setErrorHandler((error, _req, reply) => {
    logger.error({ error }, 'Erro na API');
    reply.status(500).send({ error: 'Internal server error' });
  });

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info({ port: env.PORT }, 'Fastify iniciado');

  const worker = startMediaWorker();
  startConnection().catch((err) => logger.error({ err }, 'Falha ao iniciar conexão WhatsApp'));

  const gracefulShutdown = async () => {
    logger.info('Encerrando...');
    const sock = getSocket();
    if (sock) {
      try { sock.end(new Error('shutdown')); } catch {}
    }
    await worker.close();
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
