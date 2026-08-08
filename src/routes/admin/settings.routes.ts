import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db/client.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/admin/api/settings', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    reply.send(map);
  });

  app.put('/admin/api/settings', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const body = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value, updatedAt: new Date() },
        create: { key, value },
      });
    }
    reply.send({ ok: true });
  });
}
