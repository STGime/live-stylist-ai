// Follow-up migration: adds the follower_alias column to the follows table.
// Run once on any project that already has the follows table from
// provision-follow-feature.ts.
//
//   npx tsx scripts/migrate-follower-alias.ts

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

async function main(): Promise<void> {
  const sql = eb.db.sql ?? eb.db.raw ?? null;
  if (!sql) {
    throw new Error('Eurobase SDK does not expose a raw SQL helper on this version');
  }
  await sql(`ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_alias TEXT`);
  console.log('follows.follower_alias added (or already present)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
