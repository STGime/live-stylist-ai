import { logger } from '../utils/logger.js';
import * as dbService from './db.service.js';

// Expo's push REST endpoint is HTTP-only, so we don't pull in the SDK —
// keeps dependencies small. Format docs:
//   https://docs.expo.dev/push-notifications/sending-notifications/

export type PushCategory = 'follow_request' | 'follow_accepted' | 'new_session';

interface PushBody {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'default' | 'high';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendRaw(messages: PushBody[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ status: res.status, text }, 'Expo push request failed');
      return;
    }
    const json = await res.json().catch(() => null) as { data?: Array<{ status: string; message?: string; details?: { error?: string } }> } | null;
    if (json?.data) {
      for (const ticket of json.data) {
        if (ticket.status === 'error') {
          logger.warn({ ticket }, 'Expo push ticket reported error');
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'Expo push send threw');
  }
}

export async function sendPush(
  deviceId: string,
  category: PushCategory,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const user = await dbService.getUser(deviceId).catch(() => null);
  const token = user?.expo_push_token;
  if (!token) {
    // Demoted from info: very common (any user who hasn't granted
    // notifications) and would otherwise dominate log volume.
    logger.debug({ deviceId, category }, 'Skipping push: no token');
    return;
  }
  await sendRaw([
    {
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: { category, ...data },
    },
  ]);
}

export async function fanoutPush(
  deviceIds: string[],
  category: PushCategory,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (deviceIds.length === 0) return;
  const tokens = await Promise.all(
    deviceIds.map(async (id) => {
      const u = await dbService.getUser(id).catch(() => null);
      return u?.expo_push_token ?? null;
    }),
  );
  const messages: PushBody[] = tokens
    .filter((t): t is string => !!t)
    .map((token) => ({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: { category, ...data },
    }));
  // Expo recommends batches of 100
  for (let i = 0; i < messages.length; i += 100) {
    await sendRaw(messages.slice(i, i + 100));
  }
}
