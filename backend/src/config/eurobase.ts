import { createClient, type EurobaseClient } from '@eurobase/sdk';
import { getEnv } from './env.js';
import { logger } from '../utils/logger.js';

let _eb: EurobaseClient | null = null;

export function getEurobase(): EurobaseClient {
  if (_eb) return _eb;

  const env = getEnv();
  _eb = createClient({
    url: env.EUROBASE_URL,
    apiKey: env.EUROBASE_SECRET_KEY,
  });
  logger.info({ url: env.EUROBASE_URL }, 'Eurobase client initialized');
  return _eb;
}

export async function pingEurobase(): Promise<void> {
  const eb = getEurobase();
  const { ok, latency_ms } = await eb.status();
  if (!ok) {
    logger.fatal({ latency_ms }, 'Eurobase status check failed');
    throw new Error('Eurobase is unreachable');
  }
  logger.info({ latency_ms }, 'Eurobase reachable');
}
