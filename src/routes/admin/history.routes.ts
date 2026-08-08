import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db/client.js';

export async function historyRoutes(app: FastifyInstance) {
  app.get('/admin/api/history', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const query = req.query as Record<string, string>;
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.contactId) where.contactId = query.contactId;
    if (query.status) where.status = query.status;
    if (query.mediaType) where.mediaType = query.mediaType;
    if (query.requestType) where.requestType = query.requestType;

    const [items, total] = await Promise.all([
      prisma.stickerRequest.findMany({
        where,
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stickerRequest.count({ where }),
    ]);

    reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });

  app.get('/admin/api/history/:id', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    const item = await prisma.stickerRequest.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!item) {
      reply.status(404).send({ error: 'Não encontrado' });
      return;
    }
    reply.send(item);
  });
}
