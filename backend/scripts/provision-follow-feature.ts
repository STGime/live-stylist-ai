// Schema additions for the follow feature.
// Run once against a Eurobase project that already has app_users / sessions /
// session_memories provisioned (see provision-eurobase.ts).
//
//   npx tsx scripts/provision-follow-feature.ts
//
// Existing app_users rows need a magic_id backfilled separately — see
// backfill-magic-ids.ts.

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

async function main(): Promise<void> {
  // app_users: add magic_id + expo_push_token.
  // Eurobase SDK doesn't expose addColumn directly across all versions, so
  // we issue raw SQL via the db.sql escape hatch.
  const sql = eb.db.sql ?? eb.db.raw ?? null;
  if (!sql) {
    throw new Error('Eurobase SDK does not expose a raw SQL helper on this version');
  }

  await sql(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS magic_id TEXT`);
  await sql(`CREATE UNIQUE INDEX IF NOT EXISTS app_users_magic_id_uniq ON app_users(magic_id)`);
  await sql(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS expo_push_token TEXT`);

  // follows
  const f = await eb.db.schema.createTable('follows', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true, default_value: 'gen_random_uuid()' },
      { name: 'follower_device_id', type: 'text' },
      { name: 'followee_device_id', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default_value: 'now()' },
      { name: 'responded_at', type: 'timestamptz', nullable: true },
    ],
    disableRLS: true,
  });
  console.log('follows:', JSON.stringify(f, null, 2));

  await sql(
    `CREATE UNIQUE INDEX IF NOT EXISTS follows_pair_uniq
       ON follows(follower_device_id, followee_device_id)`,
  );
  await sql(`CREATE INDEX IF NOT EXISTS follows_followee_status ON follows(followee_device_id, status)`);
  await sql(`CREATE INDEX IF NOT EXISTS follows_follower_status ON follows(follower_device_id, status)`);

  // session_images
  const si = await eb.db.schema.createTable('session_images', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true, default_value: 'gen_random_uuid()' },
      { name: 'session_id', type: 'uuid' },
      { name: 'device_id', type: 'text' },
      { name: 'storage_url', type: 'text' },
      { name: 'mime_type', type: 'text' },
      { name: 'prompt', type: 'text' },
      { name: 'description', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz', default_value: 'now()' },
      { name: 'expires_at', type: 'timestamptz' },
    ],
    disableRLS: true,
  });
  console.log('session_images:', JSON.stringify(si, null, 2));

  await sql(`CREATE INDEX IF NOT EXISTS session_images_session ON session_images(session_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS session_images_expires ON session_images(expires_at)`);
  await sql(`CREATE INDEX IF NOT EXISTS session_images_device ON session_images(device_id)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
