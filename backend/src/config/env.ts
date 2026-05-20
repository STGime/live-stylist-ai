import { z } from 'zod';
import { logger } from '../utils/logger.js';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  EUROBASE_URL: z.string().url(),
  EUROBASE_SECRET_KEY: z.string().regex(/^eb_sk_/, 'Eurobase secret key must start with eb_sk_'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash-native-audio-latest'),
  FAL_AI_KEY: z.string().min(1),
  // Preview delivery mode. 'url' (default, fast) sends the Fal CDN URL
  // straight to the client; 'base64' fetches the image server-side and
  // ships it inline. Flip to 'base64' if Fal CDN URLs ever stop being
  // reachable from clients or if we need to enforce server-side egress.
  PREVIEW_DELIVERY: z.enum(['url', 'base64']).default('url'),
  REVENUECAT_API_KEY: z.string().min(1),
  // Tier model: free users get 1 lifetime trial session; premium users get
  // a generous monthly soft cap. Daily limits removed (lifetime trial fits
  // the cost-per-session economics — see plan).
  MONTHLY_PREMIUM_SESSION_CAP: z.coerce.number().default(30),
  // Internal / beta tester gating — bypasses the lifetime-trial gate and
  // gets a generous monthly cap. Two ways to grant it:
  //   1. Add the device's UUID to TESTER_DEVICE_IDS (comma-separated).
  //   2. Build the app with EXPO_PUBLIC_TESTER_SECRET set to the same
  //      value as TESTER_SECRET here; the app sends `X-Tester-Secret` on
  //      every request and any device using that build is auto-tester.
  TESTER_DEVICE_IDS: z.string().optional(),
  TESTER_SECRET: z.string().optional(),
  TESTER_MONTHLY_SESSION_CAP: z.coerce.number().default(100),
  // Comma-separated list of device IDs allowed to call the admin-only
  // reports endpoints (#14a). Operator-managed via gcloud — persists
  // across cloudbuild deploys since #28.
  ADMIN_DEVICE_IDS: z.string().optional(),
  SESSION_DURATION_SECONDS: z.coerce.number().default(300),
  SESSION_WARNING_SECONDS: z.coerce.number().default(270),
  AWIN_API_TOKEN: z.string().optional(),
  AWIN_AFFILIATE_ID: z.string().optional(),
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
