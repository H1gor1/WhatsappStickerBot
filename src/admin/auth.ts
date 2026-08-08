import { randomBytes, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');

export async function registerAuth(app: FastifyInstance) {
  await app.register(import('@fastify/jwt'), {
    secret: JWT_SECRET,
    cookie: { cookieName: 'token', signed: false },
  });
  await app.register(import('@fastify/cookie'));

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Não autorizado' });
    }
  });
}

export async function loginHandler(req: FastifyRequest, reply: FastifyReply) {
  const { username, password } = req.body as { username: string; password: string };

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user) {
    reply.status(401).send({ error: 'Credenciais inválidas' });
    return;
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    reply.status(401).send({ error: 'Credenciais inválidas' });
    return;
  }

  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = await reply.jwtSign({ sub: user.id, username: user.username });
  reply
    .setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    })
    .send({ ok: true });
}

export async function logoutHandler(_req: FastifyRequest, reply: FastifyReply) {
  reply.clearCookie('token', { path: '/' }).send({ ok: true });
}

export async function ensureAdmin() {
  const count = await prisma.adminUser.count();
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'botfig2024';
  const hash = await argon2.hash(password);

  await prisma.adminUser.create({
    data: { username, passwordHash: hash },
  });

  logger.info({ username }, 'Usuário admin criado (defina ADMIN_USERNAME e ADMIN_PASSWORD no .env)');
}
