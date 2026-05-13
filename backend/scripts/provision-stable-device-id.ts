// Adds `stable_device_id` to `app_users` for persistent identity across
// app reinstalls. See GitHub issue #9 for context.
//
//   npx tsx scripts/provision-stable-device-id.ts
//
// ROLLOUT:
//   1. Run this script. It prints two SQL statements to apply manually
//      (the SDK only supports `createTable`; ALTER + CREATE INDEX have
//      to be run via the Eurobase admin console or MCP `runSQL`).
//   2. After the column + unique index exist, deploy the backend code.
//      Old clients without `stable_device_id` keep working — the column
//      stays NULL for them until they upgrade and POST /me/link-stable-id.
//   3. New clients send `stable_device_id` in POST /register; the backend
//      uses it to recover the original `device_id` after a reinstall, so
//      reinstalling no longer mints a fresh `app_users` row (and no longer
//      hands the user a brand-new free-trial session).
//
// The column is `text NULL` with a partial unique index (only enforces
// uniqueness on non-NULL values), so legacy rows with NULL stable_id
// coexist with new ones without violating the constraint.

const SQL = [
  `ALTER TABLE app_users
     ADD COLUMN IF NOT EXISTS stable_device_id text;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS app_users_stable_device_id_uniq
     ON app_users(stable_device_id)
     WHERE stable_device_id IS NOT NULL;`,
];

console.log('--- Run the following SQL via the Eurobase admin console / MCP: ---\n');
for (const stmt of SQL) console.log(stmt);
console.log('\nAfter both succeed, deploy the backend.');
