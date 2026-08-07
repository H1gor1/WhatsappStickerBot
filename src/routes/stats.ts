import type { FastifyInstance } from 'fastify';
import { getStickerStats, getStickerRequest } from '../db/repositories/sticker.repository.js';

export async function statsRoutes(app: FastifyInstance) {
  app.get('/stats', async (_req, reply) => {
    const stats = await getStickerStats();
    reply.send(stats);
  });

  app.get('/stickers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sticker = await getStickerRequest(id);
    if (!sticker) {
      reply.status(404).send({ error: 'Sticker não encontrado' });
      return;
    }
    reply.send(sticker);
  });
}
