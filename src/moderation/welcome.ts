import { prisma } from '../db/client.js';

export async function getWelcomeMessage(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: 'welcome_message' } });
  return setting?.value || null;
}

export async function isFirstContact(jid: string): Promise<boolean> {
  const contact = await prisma.contact.findUnique({
    where: { jid },
    include: { _count: { select: { stickers: true } } },
  });
  if (!contact) return true;
  return contact._count.stickers === 0;
}
