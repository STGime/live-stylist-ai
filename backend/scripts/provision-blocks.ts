// Schema for the `blocks` table — App Store-ready hard block.
// `denied` on follows remains soft-snooze (reopens on re-request).
// `blocks` is the terminal, user-visible block surface.
//
//   npx tsx scripts/provision-blocks.ts
//
// ROLLOUT CHECKLIST (must be done in order):
//   1. Run this script. It will create the `blocks` table and exit, printing
//      the index SQL to stdout. Without step 2, isBlocked / listBlocks queries
//      do full table scans — fine in dev, not fine after the table grows.
//   2. Apply the following SQL via the Eurobase admin console (also printed
//      at the end of step 1):
//        CREATE UNIQUE INDEX IF NOT EXISTS blocks_pair_uniq
//          ON blocks(blocker_device_id, blocked_device_id);
//        CREATE INDEX IF NOT EXISTS blocks_blocker
//          ON blocks(blocker_device_id);
//        CREATE INDEX IF NOT EXISTS blocks_blocked
//          ON blocks(blocked_device_id);
//   3. Deploy the backend. /blocks endpoints + isBlocked checks become live.
//
// SECURITY NOTE: like `follows` and `session_images`, this table runs with
// disableRLS: true — all access is through the backend with the eb_sk_*
// service key. If anonymous Eurobase client access from devices is ever
// enabled, write a proper RLS policy first (blocks should only ever be
// visible to the blocker).

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

const INDEX_SQL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS blocks_pair_uniq
     ON blocks(blocker_device_id, blocked_device_id);`,
  `CREATE INDEX IF NOT EXISTS blocks_blocker ON blocks(blocker_device_id);`,
  `CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks(blocked_device_id);`,
];

async function main(): Promise<void> {
  const b = await eb.db.schema.createTable('blocks', {
    columns: [
      { name: 'id', type: 'uuid', primary_key: true, default_value: 'gen_random_uuid()' },
      { name: 'blocker_device_id', type: 'text' },
      { name: 'blocked_device_id', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default_value: 'now()' },
    ],
    disableRLS: true,
  });
  console.log('blocks:', b.error ?? b.data?.status ?? 'ok');

  console.log('\n--- Run the following SQL via the Eurobase admin console: ---\n');
  for (const stmt of INDEX_SQL) console.log(stmt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
