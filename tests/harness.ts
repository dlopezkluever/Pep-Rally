import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import pg from "pg";
import { z } from "zod";

/**
 * A uniquely named PostgreSQL database with all migrations applied, plus the
 * fixed non-human worker identity the production worker uses. Fixtures made
 * with it are synthetic and never touch the working knowledge base.
 */
export async function createDisposableDatabase() {
  const name = `peppy_verify_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(
    z.string().parse(process.env.MIGRATION_DATABASE_URL),
  );
  const ownerUrl = new URL(adminUrl);
  ownerUrl.pathname = `/${name}`;
  const urlFor = (variable: string) => {
    const url = new URL(z.string().parse(process.env[variable]));
    url.pathname = `/${name}`;
    return url;
  };
  const root = new pg.Client({ connectionString: adminUrl.toString() });
  await root.connect();
  await root.query(`CREATE DATABASE "${name}"`);
  await root.end();
  const migrate = () =>
    new Promise<void>((resolve, reject) =>
      execFile(
        process.execPath,
        ["scripts/migrate.mjs"],
        {
          env: { ...process.env, MIGRATION_DATABASE_URL: ownerUrl.toString() },
          windowsHide: true,
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
  await migrate();
  const owner = new pg.Client({
    connectionString: ownerUrl.toString(),
    options: "-c search_path=wiki,public",
  });
  await owner.connect();
  const workerUrl = urlFor("WORKER_DATABASE_URL");
  const workerActor = z
    .object({ id: z.uuid() })
    .parse(
      (
        await owner.query(
          "INSERT INTO wiki.actor(email,display_name,password_hash,role,is_human) VALUES('worker@internal','Synthetic worker','disabled','researcher',false) RETURNING id",
        )
      ).rows[0],
    ).id;
  await owner.query(
    "INSERT INTO wiki.runtime_identity(login_name,actor_id) VALUES($1,$2)",
    [decodeURIComponent(workerUrl.username), workerActor],
  );
  return {
    name,
    owner,
    ownerUrl,
    serverUrl: urlFor("DATABASE_URL"),
    workerUrl,
    async migrate() {
      await migrate();
    },
    async drop() {
      await owner.end();
      const admin = new pg.Client({ connectionString: adminUrl.toString() });
      await admin.connect();
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
        [name],
      );
      await admin.query(`DROP DATABASE "${name}"`);
      await admin.end();
    },
  };
}
