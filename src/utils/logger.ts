import pino from 'pino';
import { loadEnv } from '../config/env.js';
import { prisma } from '../db/client.js';

const env = loadEnv();

const rawLogger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

const originalError = rawLogger.error.bind(rawLogger);

rawLogger.error = function (obj: any, msg?: string) {
  originalError(obj, msg);

  const message = msg || (typeof obj === 'string' ? obj : obj?.message) || 'Unknown';
  const stack = obj?.stack?.substring?.(0, 2000);

  prisma.errorLog.create({
    data: { message: message?.substring?.(0, 500) ?? 'Unknown', stack, context: msg },
  }).catch(() => {});
} as typeof rawLogger.error;

export const logger = rawLogger;
