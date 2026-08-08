import { prisma } from '../db/client.js';

export async function matchCommand(text: string): Promise<string | null> {
  const commands = await prisma.command.findMany({ where: { isActive: true } });

  for (const cmd of commands) {
    const trigger = cmd.trigger.toLowerCase();
    const input = text.trim().toLowerCase();

    switch (cmd.matchType) {
      case 'EXACT':
        if (input === trigger) return cmd.responseText;
        break;
      case 'STARTS_WITH':
        if (input.startsWith(trigger)) return cmd.responseText;
        break;
      case 'CONTAINS':
        if (input.includes(trigger)) return cmd.responseText;
        break;
    }
  }

  return null;
}
