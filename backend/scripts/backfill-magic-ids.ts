// One-off: assign magic_id to any app_users row that doesn't have one yet.
//
// Safe by default: without flags, it prints what *would* happen and exits.
// Pass --apply to actually write.
//
//   npx tsx scripts/backfill-magic-ids.ts            # dry run (default)
//   npx tsx scripts/backfill-magic-ids.ts --apply    # perform writes

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';
import { generateMagicId } from '../src/services/magic-id.service.js';

const APPLY = process.argv.includes('--apply');

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

interface Row {
  id: string;
  device_id?: string;
  magic_id?: string | null;
}

async function main(): Promise<void> {
  const mode = APPLY ? 'APPLY' : 'DRY-RUN';
  console.log(`Mode: ${mode}`);
  if (!APPLY) {
    console.log('No changes will be written. Re-run with --apply to perform the backfill.');
  }

  const { data, error } = await eb.db.from<Row>('app_users').select('id,device_id,magic_id');
  if (error) throw new Error(`select failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  const missing = rows.filter((r) => !r.magic_id);
  console.log(`Found ${rows.length} users; ${missing.length} missing magic_id.`);

  if (!APPLY) {
    for (const row of missing) {
      console.log(`  would assign magic_id to id=${row.id} (device_id=${row.device_id ?? '?'})`);
    }
    return;
  }

  let updated = 0;
  for (const row of missing) {
    // Retry on unique-violation
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateMagicId();
      const upd = await eb.db.from('app_users').update(row.id, { magic_id: candidate });
      if (!upd.error) {
        console.log(`  assigned ${candidate} to id=${row.id}`);
        updated++;
        break;
      }
      if (!/magic[_-]?id|app_users_magic_id_uniq/i.test(String(upd.error))) {
        throw new Error(`update failed for ${row.id}: ${upd.error}`);
      }
      console.warn(`  collision on ${candidate}, retrying`);
    }
  }
  console.log(`Backfilled magic_id for ${updated} of ${missing.length} users.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
