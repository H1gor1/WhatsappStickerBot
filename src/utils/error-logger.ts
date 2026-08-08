import { prisma } from '../db/client.js';
import { logger as pinoLogger } from '../utils/logger.js';

export async function logError(err: unknown, context?: string) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  pinoLogger.error({ error: err, context }, String(context || 'error'));

  try {
    await prisma.errorLog.create({
      data: { message: message.substring(0, 500), stack: stack?.substring(0, 2000), context },
    });
  } catch {}
}
