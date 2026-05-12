// Declare all cron schedules used by the LiveStylist backend, via
// @eurobase/sdk's schedules client (added in v0.3.0, closes euroback#112).
// Idempotent — uses createOrUpdate, safe to re-run after editing the spec.
//
//   npx tsx scripts/provision-schedules.ts
//
// Notes:
//   - The target function (`purge-expired-images`) has to be deployed to
//     Eurobase before any tick can do work. Source lives in
//     `functions/purge-expired-images.ts` — paste it into the Eurobase
//     dashboard once until `eb.functions.deploy(...)` lands in the SDK.
//   - Once this script + the deployed function are both in place,
//     /internal/purge-images, PURGE_SECRET, the Cloud Run env mount,
//     and scripts/setup-purge-scheduler.sh are all redundant and can
//     be retired.

import 'dotenv/config';
import { createClient } from '@eurobase/sdk';

const eb = createClient({
  url: process.env.EUROBASE_URL!,
  apiKey: process.env.EUROBASE_SECRET_KEY!,
});

async function main(): Promise<void> {
  const { data, error } = await eb.functions.schedules.createOrUpdate(
    'purge-expired-images',
    {
      functionName: 'purge-expired-images',
      cron: '0 4 * * *', // 04:00 UTC daily — quiet hour for EU + US users.
      timezone: 'UTC',
      description: 'Daily purge of session_images rows past 24h TTL.',
    },
  );
  if (error) {
    console.error('schedule create/update failed:', error);
    process.exit(1);
  }
  console.log('schedule ready:', {
    name: data?.name,
    cron: data?.cron,
    timezone: data?.timezone,
    enabled: data?.enabled,
    runCount: data?.runCount,
    lastRunAt: data?.lastRunAt,
    lastError: data?.lastError,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
