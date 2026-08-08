import { prisma } from '../client.js';

export type StickerStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export async function createStickerRequest(data: {
  contactId: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF';
  source?: string;
  sourceUrl?: string;
  requestType?: 'STICKER' | 'DOWNLOAD';
}) {
  return prisma.stickerRequest.create({ data });
}

export async function updateStickerStatus(
  id: string,
  status: StickerStatus,
  extra?: { originalPath?: string; resultPath?: string; errorMessage?: string; processedAt?: Date }
) {
  return prisma.stickerRequest.update({
    where: { id },
    data: { status, ...extra },
  });
}

export async function getStickerRequest(id: string) {
  return prisma.stickerRequest.findUnique({ where: { id }, include: { contact: true } });
}

export async function getStickerStats() {
  const [total, done, failed, lastWeekTotal] = await Promise.all([
    prisma.stickerRequest.count(),
    prisma.stickerRequest.count({ where: { status: 'DONE' } }),
    prisma.stickerRequest.count({ where: { status: 'FAILED' } }),
    prisma.stickerRequest.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return { total, done, failed, lastWeekTotal };
}
