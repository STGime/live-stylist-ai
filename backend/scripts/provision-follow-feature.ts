// Schema additions for the follow feature.
//
//   npx tsx scripts/provision-follow-feature.ts
//
// What this does, idempotently:
//   - adds magic_id + expo_push_token columns to app_users (via schema.addColumn)
//   - creates the follows table
//   - creates the session_images table
//
// What it CAN'T do via the Eurobase SDK as of v0.2.2: create indexes or
// alter constraints. The SQL statements for those are printed at the end so
// they can be applied via the Eurobase admin SQL console (or the existing
// MCP runSQL workflow). Re-running the script after the indexes exist is
// safe — `schema.createTable` and `addColumn` return errors that we surface
// but don't crash on.
//
// SECURITY NOTE: `disableRLS: true` is used here because every read/write
// against these tables goes through the backend (which carries the
// eb_sk_* service key). The Eurobase anonymous/public client is NEVER
// instantiated client-side in this project. If that ever changes, write
// real RLS policies for `follows` and `session_images` before exposing them.

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

const INDEX_SQL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS app_users_magic_id_uniq ON app_users(magic_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS follows_pair_uniq
     ON follows(follower_device_id, followee_device_id);`,
  `CREATE INDEX IF NOT EXISTS follows_followee_status ON follows(followee_device_id, status);`,
  `CREATE INDEX IF NOT EXISTS follows_follower_status ON follows(follower_device_id, status);`,
  `CREATE INDEX IF NOT EXISTS session_images_session ON session_images(session_id);`,
  `CREATE INDEX IF NOT EXISTS session_images_expires ON session_images(expires_at);`,
  `CREATE INDEX IF NOT EXISTS session_images_device ON session_images(device_id);`,
];

async function main(): Promise<void> {
  // 1. app_users: add magic_id + expo_push_token (idempotent — addColumn
  //    surfaces an error string if the column already exists; we log it).
  const magicCol = await eb.db.schema.addColumn('app_users', {
    name: 'magic_id',
    type: 'text',
    nullable: true,
  });
  console.log('app_users.magic_id:', magicCol.error ?? 'ok');

  const pushCol = await eb.db.schema.addColumn('app_users', {
    name: 'expo_push_token',
    type: 'text',
    nullable: true,
  });
  console.log('app_users.expo_push_token:', pushCol.error ?? 'ok');

  // 2. follows
  const f = await eb.db.schema.createTable('follows', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true, default_value: 'gen_random_uuid()' },
      { name: 'follower_device_id', type: 'text' },
      { name: 'followee_device_id', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'follower_alias', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz', default_value: 'now()' },
      { name: 'responded_at', type: 'timestamptz', nullable: true },
    ],
    disableRLS: true,
  });
  console.log('follows:', f.error ?? f.data?.status ?? 'ok');

  // 3. session_images
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
  console.log('session_images:', si.error ?? si.data?.status ?? 'ok');

  // 4. Indexes — SDK doesn't expose DDL for these, so we print them for
  //    manual application. They're all CREATE [UNIQUE] INDEX IF NOT EXISTS
  //    so re-running them is safe.
  console.log('\n--- Run the following SQL via the Eurobase admin console: ---\n');
  for (const stmt of INDEX_SQL) console.log(stmt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
