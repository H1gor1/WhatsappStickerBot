import type { FastifyInstance } from 'fastify';
import { loginHandler, logoutHandler, ensureAdmin } from '../admin/auth.js';
import { getStatus, getQrAsBase64Png, getConnectedNumber, switchNumber, logout } from '../admin/connection-manager.js';
import { banRoutes } from '../routes/admin/bans.routes.js';
import { settingsRoutes } from '../routes/admin/settings.routes.js';
import { commandRoutes } from '../routes/admin/commands.routes.js';
import { metricsRoutes } from '../routes/admin/metrics.routes.js';
import { historyRoutes } from '../routes/admin/history.routes.js';
import { sseRoutes } from '../routes/sse.js';
import { errorLogRoutes } from '../routes/admin/logs.routes.js';

export async function adminPlugin(app: FastifyInstance) {
  await ensureAdmin();

  app.post('/admin/api/auth/login', loginHandler);
  app.post('/admin/api/auth/logout', logoutHandler);

  app.get('/admin/api/status', { preHandler: [app.authenticate] }, async (_req, reply) => {
    reply.send({ status: getStatus(), number: getConnectedNumber() });
  });

  app.get('/admin/api/status/qr', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const qr = await getQrAsBase64Png();
    if (!qr) {
      reply.status(404).send({ error: 'QR code não disponível' });
      return;
    }
    reply.send({ qr });
  });

  app.post('/admin/api/status/switch-number', { preHandler: [app.authenticate] }, async (_req, reply) => {
    await switchNumber();
    reply.send({ ok: true });
  });

  app.post('/admin/api/status/logout', { preHandler: [app.authenticate] }, async (_req, reply) => {
    await logout();
    reply.send({ ok: true });
  });

  await app.register(banRoutes);
  await app.register(settingsRoutes);
  await app.register(commandRoutes);
  await app.register(metricsRoutes);
  await app.register(historyRoutes);
  await app.register(sseRoutes);
  await app.register(errorLogRoutes);
}
