import pg, { type PoolClient } from "pg";
import { z } from "zod";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  options: "-c search_path=wiki,public",
});
export async function transaction<T>(
  actorId: string | null,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('wiki.actor_id',$1,true)", [
      actorId ?? "",
    ]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function value<T>(
  sql: string,
  params: unknown[],
  schema: z.ZodType<T>,
  actorId: string | null = null,
): Promise<T> {
  return transaction(actorId, async (client) => {
    const result = await client.query(sql, params);
    return schema.parse(result.rows[0]?.data);
  });
}
export async function closeDatabase() {
  await pool.end();
}
