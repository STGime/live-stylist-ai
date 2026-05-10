import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

async function main(): Promise<void> {
  // app_users
  const u = await eb.db.schema.createTable('app_users', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true, default_value: 'gen_random_uuid()' },
      { name: 'device_id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'favorite_color', type: 'text' },
      { name: 'stylist_name', type: 'text', nullable: true },
      { name: 'language', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz', default_value: 'now()' },
      { name: 'sessions_used_today', type: 'integer', default_value: '0' },
      { name: 'last_session_date', type: 'text' },
    ],
    disableRLS: true,
  });
  console.log('app_users:', JSON.stringify(u, null, 2));

  // sessions
  const s = await eb.db.schema.createTable('sessions', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true },
      { name: 'device_id', type: 'text' },
      { name: 'start_time', type: 'timestamptz', default_value: 'now()' },
      { name: 'end_time', type: 'timestamptz', nullable: true },
      { name: 'duration_seconds', type: 'integer', nullable: true },
      { name: 'subscription_tier', type: 'text' },
      { name: 'status', type: 'text' },
    ],
    disableRLS: true,
  });
  console.log('sessions:', JSON.stringify(s, null, 2));

  // session_memories
  const m = await eb.db.schema.createTable('session_memories', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true, default_value: 'gen_random_uuid()' },
      { name: 'device_id', type: 'text' },
      { name: 'session_id', type: 'uuid' },
      { name: 'summary', type: 'text' },
      { name: 'tips', type: 'jsonb', nullable: true },
      { name: 'products', type: 'jsonb', nullable: true },
      { name: 'duration_seconds', type: 'integer', nullable: true },
      { name: 'occasion', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz', default_value: 'now()' },
    ],
    disableRLS: true,
  });
  console.log('session_memories:', JSON.stringify(m, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
