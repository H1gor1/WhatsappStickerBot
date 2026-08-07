import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess((v) => Number(v ?? 3000), z.number().int().positive()),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().default('file:./data/dev.db'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.preprocess((v) => Number(v ?? 6379), z.number().int().positive()),
  REDIS_PASSWORD: z.string().optional(),

  STICKER_PACK_NAME: z.string().default('higorlino.dev bot'),
  STICKER_AUTHOR: z.string().default('higorlino.dev'),
  RATE_LIMIT_MAX: z.preprocess((v) => Number(v ?? 10), z.number().int().positive()),
  RATE_LIMIT_WINDOW_MS: z.preprocess((v) => Number(v ?? 60000), z.number().int().positive()),
  STORAGE_PATH: z.string().default('./storage'),
  SESSIONS_PATH: z.string().default('./sessions'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten());
    process.exit(1);
  }
  cached = result.data;
  return cached;
}
