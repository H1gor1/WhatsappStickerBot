import type { FastifyInstance } from 'fastify';
import { getConnectionStatus } from '../whatsapp/connection.js';

export async function statusRoutes(app: FastifyInstance) {
  app.get('/status', async (_req, reply) => {
    const connStatus = getConnectionStatus();
    reply.send({
      connection: connStatus.status,
      hasQR: connStatus.qrCode !== null,
    });
  });

  app.get('/status/qr', async (_req, reply) => {
    const connStatus = getConnectionStatus();
    if (!connStatus.qrCode) {
      reply.status(404).send({ error: 'QR code não disponível' });
      return;
    }
    reply.type('text/plain').send(connStatus.qrCode);
  });
}
