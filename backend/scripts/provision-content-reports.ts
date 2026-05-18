// Adds the `content_reports` table + `session_memories.hidden_at`
// column for App Review §1.2 UGC compliance (#14a). Operators
// moderate reports via curl using a device id listed in
// ADMIN_DEVICE_IDS env on Cloud Run.
//
//   npx tsx scripts/provision-content-reports.ts
//
// ROLLOUT:
//   1. Run this script. It prints the four DDL statements to apply
//      manually (Eurobase SDK only supports createTable, ALTER /
//      CREATE INDEX have to go via the admin console or MCP runSQL).
//   2. After the schema change lands, deploy the backend with the
//      new POST /reports endpoints + the hidden_at filter in feeds.
//   3. Set ADMIN_DEVICE_IDS on Cloud Run via
//      `gcloud run services update --update-env-vars=^@^ADMIN_DEVICE_IDS=…`.
//      Persists across deploys since cloudbuild was switched to
//      --update-env-vars in #28.

const SQL = [
  `CREATE TABLE IF NOT EXISTS content_reports (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     reporter_device_id text NOT NULL,
     target_kind text NOT NULL CHECK (target_kind IN ('session','follow_request','user')),
     target_id text NOT NULL,
     category text NOT NULL CHECK (category IN ('sexual','violent','harassing','spam','other')),
     free_text text,
     status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','content_removed','user_banned')),
     created_at timestamptz DEFAULT now(),
     resolved_at timestamptz,
     resolved_by_device_id text
   );`,
  `CREATE INDEX IF NOT EXISTS content_reports_status ON content_reports(status);`,
  `CREATE INDEX IF NOT EXISTS content_reports_target ON content_reports(target_kind, target_id);`,
  `ALTER TABLE session_memories ADD COLUMN IF NOT EXISTS hidden_at timestamptz;`,
];

console.log('--- Run the following SQL via the Eurobase admin console / MCP: ---\n');
for (const stmt of SQL) console.log(stmt);
console.log('\nAfter the schema change lands, deploy the backend.');
