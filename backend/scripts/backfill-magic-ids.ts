// One-off: assign magic_id to any app_users row that doesn't have one yet.
//
//   npx tsx scripts/backfill-magic-ids.ts

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';
import { generateMagicId } from '../src/services/magic-id.service.js';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

interface Row {
  id: string;
  magic_id?: string | null;
}

async function main(): Promise<void> {
  const { data, error } = await eb.db.from<Row>('app_users').select('id,magic_id');
  if (error) throw new Error(`select failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  let updated = 0;
  for (const row of rows) {
    if (row.magic_id) continue;

    // Retry on unique-violation
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateMagicId();
      const upd = await eb.db.from('app_users').update(row.id, { magic_id: candidate });
      if (!upd.error) {
        updated++;
        break;
      }
      if (!/unique|duplicate/i.test(String(upd.error))) {
        throw new Error(`update failed for ${row.id}: ${upd.error}`);
      }
      console.warn(`collision on ${candidate}, retrying`);
    }
  }
  console.log(`backfilled magic_id for ${updated} of ${rows.length} users`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
