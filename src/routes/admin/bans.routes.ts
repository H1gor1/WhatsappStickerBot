import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/client.js';

export async function banRoutes(app: FastifyInstance) {
  app.get('/admin/api/bans', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const bans = await prisma.bannedContact.findMany({ orderBy: { bannedAt: 'desc' } });
    reply.send(bans);
  });

  app.post('/admin/api/bans', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const { jid, reason } = req.body as { jid: string; reason?: string };
    const ban = await prisma.bannedContact.create({
      data: { jid, reason },
    });
    reply.status(201).send(ban);
  });

  app.delete('/admin/api/bans/:id', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    await prisma.bannedContact.delete({ where: { id } });
    reply.send({ ok: true });
  });
}
