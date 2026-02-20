import { z } from 'zod';
import { logger } from '../utils/logger';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FIREBASE_PROJECT_ID: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash-native-audio-latest'),
  REVENUECAT_API_KEY: z.string().min(1),
  FREE_SESSIONS_PER_DAY: z.coerce.number().default(1),
  PREMIUM_SESSIONS_PER_DAY: z.coerce.number().default(5),
  SESSION_DURATION_SECONDS: z.coerce.number().default(300),
  SESSION_WARNING_SECONDS: z.coerce.number().default(270),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    logger.fatal({ errors: result.error.flatten().fieldErrors }, 'Invalid environment variables');
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) return loadEnv();
  return _env;
}
