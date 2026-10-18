import { createHash } from "node:crypto";
import { z } from "zod";
if (!process.env.WORKER_DATABASE_URL)
  throw new Error("WORKER_DATABASE_URL is required");
process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
const { transaction, closeDatabase } = await import("../src/lib/db");
const name = z.string().trim().min(2).max(120).parse(process.argv[2]);
const aliases = process.argv
  .slice(3)
  .filter((a) => !a.startsWith("--"))
  .map((a) => z.string().trim().min(2).max(120).parse(a));
const identifiers = process.argv
  .slice(3)
  .filter((a) => a.startsWith("--"))
  .map((flag) => {
    const match = /^--(pubchem|uniprot|iuphar)=([a-zA-Z0-9-]+)$/.exec(flag);
    if (!match)
      throw new Error(
        "Seed identifiers use --pubchem=CID, --uniprot=ACCESSION, or --iuphar=LIGAND_ID",
      );
    return { namespace: match[1], value: match[2] };
  });
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
try {
  const id = await transaction(null, async (c) => {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matches = await c.query(
      "SELECT DISTINCT p.id FROM wiki.peptide p LEFT JOIN wiki.peptide_alias a ON a.peptide_id=p.id WHERE regexp_replace(lower(p.canonical_name),'[^a-z0-9]','','g')=$1 OR a.normalized=$1",
      [normalized],
    );
    if (matches.rowCount && matches.rowCount > 1)
      throw new Error(
        "Ambiguous identity: resolve the alias with an editor before research",
      );
    if (!matches.rowCount)
      await c.query(
        "INSERT INTO wiki.peptide(canonical_name,slug) VALUES($1,$2)",
        [name, slug],
      );
    const peptide = z
      .object({ id: z.uuid() })
      .parse(
        matches.rows[0] ??
          (
            await c.query(
              "SELECT id FROM wiki.peptide WHERE canonical_name=$1",
              [name],
            )
          ).rows[0],
      );
    for (const alias of aliases)
      await c.query(
        "INSERT INTO wiki.peptide_alias(peptide_id,alias,alias_type) VALUES($1,$2,'scientific') ON CONFLICT DO NOTHING",
        [peptide.id, alias],
      );
    for (const identifier of identifiers) {
      const existing = await c.query(
        "SELECT peptide_id FROM wiki.peptide_identifier WHERE namespace=$1 AND value=$2",
        [identifier.namespace, identifier.value],
      );
      if (existing.rowCount && existing.rows[0].peptide_id !== peptide.id)
        throw new Error(
          "Seed identifier belongs to a different identity; editor resolution required",
        );
      await c.query(
        "INSERT INTO wiki.peptide_identifier(peptide_id,namespace,value) VALUES($1,$2,$3) ON CONFLICT(namespace,value) DO NOTHING",
        [peptide.id, identifier.namespace, identifier.value],
      );
    }
    let revision = z
      .object({ id: z.uuid() })
      .optional()
      .parse(
        (
          await c.query(
            "SELECT id FROM wiki.revision WHERE peptide_id=$1 AND status IN ('draft','researching','unresearched') ORDER BY created_at DESC LIMIT 1",
            [peptide.id],
          )
        ).rows[0],
      );
    if (!revision)
      revision = z
        .object({ id: z.uuid() })
        .parse(
          (
            await c.query(
              "INSERT INTO wiki.revision(peptide_id,status) VALUES($1,'researching') RETURNING id",
              [peptide.id],
            )
          ).rows[0],
        );
    const key = createHash("sha256")
      .update(`${peptide.id}:${new Date().toISOString().slice(0, 10)}:discover`)
      .digest("hex");
    await c.query(
      "INSERT INTO wiki.research_job(peptide_id,revision_id,kind,dedupe_key) VALUES($1,$2,'discover',$3) ON CONFLICT DO NOTHING",
      [peptide.id, revision.id, key],
    );
    return revision.id;
  });
  process.stdout.write(`Queued research for ${name}. Draft revision ${id}.\n`);
} finally {
  await closeDatabase();
}
