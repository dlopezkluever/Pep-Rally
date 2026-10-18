import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const c = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await c.connect();
try {
  const dbUrl = new URL(process.env.DATABASE_URL);
  const username = decodeURIComponent(dbUrl.username),
    password = decodeURIComponent(dbUrl.password);
  const found = await c.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
    username,
  ]);
  if (!found.rowCount) {
    const q = await c.query(
      "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L IN ROLE peppy_app', $1::text,$2::text) AS sql",
      [username, password],
    );
    await c.query(q.rows[0].sql);
  }
  const webRole = await c.query(
    "SELECT 1 FROM pg_roles WHERE rolname='peppy_web'",
  );
  if (webRole.rowCount)
    await c.query(`GRANT peppy_web TO ${pg.escapeIdentifier(username)}`);
  if (process.env.WORKER_DATABASE_URL) {
    const workerUrl = new URL(process.env.WORKER_DATABASE_URL);
    const workerName = decodeURIComponent(workerUrl.username);
    const existingWorker = await c.query(
      "SELECT 1 FROM pg_roles WHERE rolname=$1",
      [workerName],
    );
    if (!existingWorker.rowCount) {
      const q = await c.query(
        "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L IN ROLE peppy_app', $1::text,$2::text) AS sql",
        [workerName, decodeURIComponent(workerUrl.password)],
      );
      await c.query(q.rows[0].sql);
    }
    const workerActor = await c.query(
      "INSERT INTO wiki.actor(email,display_name,password_hash,role,is_human) VALUES('worker@internal','Source acquisition worker','LOGIN_DISABLED','researcher',false) ON CONFLICT(email) DO UPDATE SET is_human=false RETURNING id",
    );
    await c.query(
      "INSERT INTO wiki.runtime_identity(login_name,actor_id) VALUES($1,$2) ON CONFLICT(login_name) DO UPDATE SET actor_id=excluded.actor_id",
      [workerName, workerActor.rows[0].id],
    );
  }
  // Adopt only this initial development database, where the two foundation migrations were executed directly.
  if (process.argv.includes("--adopt-initial")) {
    await c.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migration(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("db/migrations")).filter(
      (n) => n === "001_foundation.sql" || n === "002_security_and_reads.sql",
    )) {
      const hash = createHash("sha256")
        .update(await readFile(`db/migrations/${name}`, "utf8"))
        .digest("hex");
      await c.query(
        "INSERT INTO public.schema_migration(name,hash) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [name, hash],
      );
    }
  }
  process.stdout.write("Local runtime database role is configured.\n");
} finally {
  await c.end();
}
