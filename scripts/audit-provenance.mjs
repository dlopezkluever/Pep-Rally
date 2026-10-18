import pg from "pg";
import { writeFile } from "node:fs/promises";
const c = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await c.connect();
try {
  const counts = (
    await c.query(`SELECT
    (SELECT count(*)::int FROM wiki.peptide) AS identities,
    (SELECT count(DISTINCT revision_id)::int FROM wiki.claim) AS revisions_with_claims,
    (SELECT count(*)::int FROM wiki.claim) AS claims,
    (SELECT count(*)::int FROM wiki.claim WHERE approved) AS approved_claims,
    (SELECT count(*)::int FROM wiki.source_observation) AS source_observations,
    (SELECT count(*)::int FROM wiki.trial_record) AS trial_snapshots,
    (SELECT count(*)::int FROM wiki.publication) AS historical_publications,
    (SELECT count(*)::int FROM wiki.active_publication) AS active_publications,
    (SELECT count(*)::int FROM wiki.research_job WHERE state='succeeded') AS successful_jobs`)
  ).rows[0];
  const violations = (
    await c.query(`SELECT c.id,'Claim has no supporting citation' AS reason FROM wiki.claim c WHERE NOT EXISTS(SELECT 1 FROM wiki.claim_citation cc WHERE cc.claim_id=c.id AND cc.relation='supports')
    UNION ALL SELECT c.id,'Published claim lacks approval' FROM wiki.claim c JOIN wiki.published_revision r ON r.id=c.revision_id WHERE NOT c.approved
    UNION ALL SELECT o.id,'Invalid source URL' FROM wiki.source_observation o WHERE o.url NOT LIKE 'https://%'`)
  ).rows;
  const result = {
    checkedAt: new Date().toISOString(),
    scope:
      "Structural provenance only; not scientific or human editorial validation.",
    counts,
    violations,
  };
  await writeFile(
    "research/provenance-audit.json",
    JSON.stringify(result, null, 2),
  );
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (violations.length) process.exitCode = 1;
} finally {
  await c.end();
}
