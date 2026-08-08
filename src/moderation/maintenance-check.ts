import { prisma } from '../db/client.js';

export async function isMaintenanceMode(): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { key: 'maintenance_mode' } });
  return setting?.value === 'true';
}

export async function getMaintenanceMessage(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'maintenance_message' } });
  return setting?.value || 'Bot em manutenção. Volte mais tarde. 🔧';
}
