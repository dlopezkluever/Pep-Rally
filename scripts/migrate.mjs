import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(3048001)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS public.schema_migration (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("db/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`db/migrations/${name}`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const prior = await client.query(
      "SELECT hash FROM public.schema_migration WHERE name=$1",
      [name],
    );
    if (prior.rows.length) {
      if (prior.rows[0].hash !== hash)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    if (!sql.startsWith("BEGIN;") || !sql.trimEnd().endsWith("COMMIT;"))
      throw new Error(`Migration must have an outer transaction: ${name}`);
    const body = sql.replace(/^BEGIN;\s*/, "").replace(/\s*COMMIT;\s*$/, "");
    await client.query("BEGIN");
    try {
      await client.query(body);
      await client.query(
        "INSERT INTO public.schema_migration(name,hash) VALUES($1,$2)",
        [name, hash],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    process.stdout.write(`Applied ${name}\n`);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(3048001)");
  await client.end();
}
