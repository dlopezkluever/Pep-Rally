if (!process.env.WORKER_DATABASE_URL)
  throw new Error("WORKER_DATABASE_URL is required");
process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
const { transaction, closeDatabase } = await import("../src/lib/db");
try {
  const count = await transaction(null, async (c) => {
    const r = await c.query(
      "INSERT INTO wiki.research_job(peptide_id,revision_id,kind,dedupe_key) SELECT peptide_id,id,'refresh',peptide_id::text||':refresh:'||current_date::text FROM wiki.published_revision WHERE next_review_due<=current_date ON CONFLICT DO NOTHING RETURNING id",
    );
    return r.rowCount;
  });
  process.stdout.write(
    `Queued ${count} due research refreshes. No publication changed.\n`,
  );
} finally {
  await closeDatabase();
}
export {};
