import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db/client.js';

export async function errorLogRoutes(app: FastifyInstance) {
  app.get('/admin/api/logs', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const query = req.query as Record<string, string>;
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '50'), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.errorLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.errorLog.count(),
    ]);

    reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  });

  app.delete('/admin/api/logs', { preHandler: [app.authenticate] }, async (_req, reply) => {
    await prisma.errorLog.deleteMany();
    reply.send({ ok: true });
  });
}
