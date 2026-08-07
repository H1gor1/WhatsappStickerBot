import { prisma } from '../client.js';

export async function findOrCreateContact(jid: string, name?: string) {
  let contact = await prisma.contact.findUnique({ where: { jid } });
  if (!contact) {
    contact = await prisma.contact.create({ data: { jid, name } });
  } else if (name && name !== contact.name) {
    contact = await prisma.contact.update({ where: { jid }, data: { name } });
  }
  return contact;
}

export async function getContact(jid: string) {
  return prisma.contact.findUnique({ where: { jid } });
}
