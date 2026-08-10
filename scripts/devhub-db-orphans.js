#!/usr/bin/env node
/**
 * Find (and optionally drop) DevHub project schemas whose project no longer
 * exists — orphans left behind before the delete route dropped databases.
 *
 * Dry-run by default. Nothing is dropped unless you pass --apply, because a
 * schema full of a user's data is not something to remove on a guess.
 *
 *   DEVHUB_DB_ADMIN_URL=... PLATFORM_DATABASE_URL=... node scripts/devhub-db-orphans.js
 *   DEVHUB_DB_ADMIN_URL=... PLATFORM_DATABASE_URL=... node scripts/devhub-db-orphans.js --apply
 *
 * Matching: a schema is named p_<first 12 hex of the project id, dashes
 * stripped> (see lib/devhubDbProvision.ts). Project ids are read from the
 * platform database, the only place that knows which projects still exist.
 */

// pg lives in the backend package, not at the repo root — resolve it from
// there so this runs from anywhere without a second install.
const path = require("path");
let Client;
try {
  ({ Client } = require("pg"));
} catch {
  ({ Client } = require(path.join(__dirname, "..", "aevion-globus-backend", "node_modules", "pg")));
}

const APPLY = process.argv.includes("--apply");
const adminUrl = process.env.DEVHUB_DB_ADMIN_URL;
const platformUrl = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;

function schemaNameFor(projectId) {
  return "p_" + projectId.replace(/-/g, "").slice(0, 12).toLowerCase();
}
function roleNameFor(projectId) {
  return "u_" + projectId.replace(/-/g, "").slice(0, 12).toLowerCase();
}

(async () => {
  if (!adminUrl || !platformUrl) {
    console.error("need DEVHUB_DB_ADMIN_URL and PLATFORM_DATABASE_URL (or DATABASE_URL)");
    process.exit(2);
  }

  const platform = new Client({ connectionString: platformUrl });
  await platform.connect();
  const projects = await platform.query('SELECT id FROM "DevHubProject"');
  await platform.end();
  const liveSchemas = new Set(projects.rows.map((r) => schemaNameFor(r.id)));
  console.log(`projects in platform db: ${projects.rows.length}`);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const schemas = await admin.query(
    "SELECT nspname FROM pg_namespace WHERE nspname ~ '^p_[0-9a-f]{12}$' ORDER BY 1"
  );
  console.log(`project schemas on the instance: ${schemas.rows.length}`);

  const orphans = schemas.rows.map((r) => r.nspname).filter((s) => !liveSchemas.has(s));
  if (orphans.length === 0) {
    console.log("no orphans — every schema belongs to a live project");
    await admin.end();
    return;
  }

  console.log(`\norphans (${orphans.length}):`);
  for (const s of orphans) {
    const size = await admin.query(
      `SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS bytes, COUNT(*)::int AS tables
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r'`,
      [s]
    );
    const { bytes, tables } = size.rows[0];
    console.log(`  ${s}  tables=${tables}  size=${(Number(bytes) / 1024).toFixed(1)}KB`);
  }

  if (!APPLY) {
    console.log("\ndry run — pass --apply to drop these schemas and their roles");
    await admin.end();
    return;
  }

  for (const s of orphans) {
    const role = "u_" + s.slice(2);
    await admin.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    await admin.query(`DROP OWNED BY ${role} CASCADE`).catch(() => undefined);
    await admin.query(`DROP ROLE IF EXISTS ${role}`);
    console.log(`dropped ${s} + ${role}`);
  }
  await admin.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
