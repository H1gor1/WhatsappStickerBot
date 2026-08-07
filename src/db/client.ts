import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

const adapter = new PrismaLibSql({ url: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
