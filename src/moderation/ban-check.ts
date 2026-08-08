import { prisma } from '../db/client.js';

export async function isBanned(jid: string): Promise<boolean> {
  const ban = await prisma.bannedContact.findUnique({ where: { jid } });
  return ban !== null;
}
