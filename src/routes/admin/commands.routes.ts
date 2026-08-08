import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db/client.js';

export async function commandRoutes(app: FastifyInstance) {
  app.get('/admin/api/commands', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const commands = await prisma.command.findMany({ orderBy: { createdAt: 'desc' } });
    reply.send(commands);
  });

  app.post('/admin/api/commands', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const { trigger, matchType, responseText } = req.body as {
      trigger: string;
      matchType?: string;
      responseText: string;
    };
    const cmd = await prisma.command.create({
      data: { trigger, matchType: matchType || 'EXACT', responseText },
    });
    reply.status(201).send(cmd);
  });

  app.put('/admin/api/commands/:id', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    const { trigger, matchType, responseText, isActive } = req.body as any;
    const cmd = await prisma.command.update({
      where: { id },
      data: { trigger, matchType, responseText, isActive },
    });
    reply.send(cmd);
  });

  app.delete('/admin/api/commands/:id', { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    await prisma.command.delete({ where: { id } });
    reply.send({ ok: true });
  });
}
