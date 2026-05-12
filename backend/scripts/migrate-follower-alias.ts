// Follow-up migration: adds the follower_alias column to the follows table.
// Run once on any project that already has the follows table from
// provision-follow-feature.ts.
//
//   npx tsx scripts/migrate-follower-alias.ts
//
// Uses the SDK's schema.addColumn, which is idempotent (already-exists errors
// are logged but don't crash).

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

async function main(): Promise<void> {
  const result = await eb.db.schema.addColumn('follows', {
    name: 'follower_alias',
    type: 'text',
    nullable: true,
  });
  console.log('follows.follower_alias:', result.error ?? 'ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
