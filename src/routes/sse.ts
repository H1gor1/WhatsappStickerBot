import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function sseRoutes(app: FastifyInstance) {
  app.get('/admin/api/events', { preHandler: [app.authenticate] }, (req: FastifyRequest, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write(':ok\n\n');

    const interval = setInterval(async () => {
      try {
        const { getStatus, getQrAsBase64Png, getConnectedNumber } = await import('../admin/connection-manager.js');
        const status = getStatus();
        const number = getConnectedNumber();
        const qr = await getQrAsBase64Png();
        reply.raw.write(`data: ${JSON.stringify({ status, number, qr })}\n\n`);
      } catch {
        reply.raw.write(':ping\n\n');
      }
    }, 3000);

    req.raw.on('close', () => clearInterval(interval));
  });
}
