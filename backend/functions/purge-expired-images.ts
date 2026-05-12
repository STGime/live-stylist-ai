// Eurobase edge function: deletes session_images rows whose 24h TTL has
// passed. Triggered daily at 04:00 UTC by the schedule provisioned in
// scripts/provision-schedules.ts.
//
// Until @eurobase/sdk exposes `functions.deploy(...)`, deploy this by
// pasting the body into the Eurobase dashboard:
//
//   Functions → New function
//     Name:       purge-expired-images
//     Runtime:    TypeScript (or whatever Eurobase calls its TS option)
//     Body:       (paste the source below)
//
// Replaces the Cloud Run /internal/purge-images endpoint + PURGE_SECRET +
// Cloud Scheduler chain — all of which can be retired once this is live.

// @ts-expect-error — `eurobase:edge` is provided by the Eurobase runtime
// at execution time. The SDK package on npm doesn't ship it.
import { eb } from 'eurobase:edge';

export default async function purgeExpiredImages(): Promise<{ purged: number }> {
  const nowIso = new Date().toISOString();

  // Find expired rows. Eurobase SDK 0.3 still doesn't expose a bulk DELETE
  // by WHERE clause, so fetch ids and delete each. At ~5k rows/day at
  // steady-state, this is fine; if we ever scale past that, drop in a
  // raw-SQL helper.
  const { data, error } = await eb.db
    .from<{ id: string }>('session_images')
    .select('id')
    .lte('expires_at', nowIso);
  if (error) {
    throw new Error(`select expired session_images failed: ${error}`);
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  let purged = 0;
  for (const row of rows) {
    if (!row?.id) continue;
    const del = await eb.db.from('session_images').delete(row.id);
    if (!del.error) purged++;
  }

  return { purged };
}
