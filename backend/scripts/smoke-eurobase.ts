/**
 * Cleans up smoke-test rows from a previous run.
 *
 * Usage: npx tsx scripts/smoke-eurobase.ts
 */
import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

async function main(): Promise<void> {
  const { data } = await eb.db
    .from<{ id: string; device_id: string }>('app_users')
    .select('id', 'device_id')
    .like('device_id', 'smoke-%');

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  console.log(`Found ${rows.length} smoke row(s)`);
  for (const row of rows) {
    const { error } = await eb.db.from('app_users').delete(row.id);
    console.log(`  delete ${row.device_id}: ${error ?? 'ok'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
