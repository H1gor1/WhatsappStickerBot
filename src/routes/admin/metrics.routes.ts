import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db/client.js';

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/admin/api/metrics', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const [total, done, failed, last7d, bySource] = await Promise.all([
      prisma.stickerRequest.count(),
      prisma.stickerRequest.count({ where: { status: 'DONE' } }),
      prisma.stickerRequest.count({ where: { status: 'FAILED' } }),
      prisma.stickerRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.stickerRequest.groupBy({
        by: ['source'],
        _count: true,
      }),
    ]);

    reply.send({
      total,
      done,
      failed,
      last7d,
      errorRate: total > 0 ? ((failed / total) * 100).toFixed(1) : '0',
      bySource: bySource.reduce((acc, s) => {
        acc[s.source] = s._count;
        return acc;
      }, {} as Record<string, number>),
    });
  });

  app.get('/admin/api/metrics/daily', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const days: { date: string; total: number; done: number; failed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [dayTotal, dayDone, dayFailed] = await Promise.all([
        prisma.stickerRequest.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.stickerRequest.count({ where: { createdAt: { gte: start, lt: end }, status: 'DONE' } }),
        prisma.stickerRequest.count({ where: { createdAt: { gte: start, lt: end }, status: 'FAILED' } }),
      ]);

      days.push({
        date: start.toISOString().split('T')[0],
        total: dayTotal,
        done: dayDone,
        failed: dayFailed,
      });
    }
    reply.send(days);
  });
}
