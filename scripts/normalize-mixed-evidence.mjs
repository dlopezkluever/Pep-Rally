import pg from "pg";

// One report can contain human, animal, and cell experiments. Keep their claims separate.
const splits = {
  "pmid-15817669": [
    {
      type: "animal",
      section: "animal",
      species: "Rattus norvegicus",
      text: "Rat experiments investigated the long-acting activity of albumin-binding CJC-1295.",
    },
    {
      type: "in_vitro",
      section: "cell",
      species: "Rat-derived cells",
      text: "Cultured rat anterior-pituitary assays investigated growth hormone secretion with albumin-conjugated candidates.",
    },
  ],
  "pmid-25738459": [
    {
      type: "animal",
      section: "animal",
      species: "Mus musculus",
      text: "MOTS-c administration was studied for metabolic outcomes in mice. These model-system findings do not establish human benefit.",
    },
    {
      type: "in_vitro",
      section: "cell",
      species: "Cell models",
      text: "Cell experiments investigated folate and purine metabolism and AMPK signaling in connection with MOTS-c.",
    },
  ],
  "pmid-33473109": [
    {
      type: "observational",
      section: "human",
      species: "Homo sapiens",
      text: "A human exercise study measured endogenous MOTS-c. Participants in that experiment were not given MOTS-c.",
    },
    {
      type: "animal",
      section: "animal",
      species: "Mus musculus",
      text: "The report investigated administered MOTS-c and physical capacity in mice. This does not establish therapeutic effects in humans.",
    },
    {
      type: "in_vitro",
      section: "cell",
      species: "Mouse C2C12 myoblasts",
      text: "C2C12 myoblast experiments investigated adaptation to metabolic stress in connection with MOTS-c.",
    },
  ],
};
const c = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  options: "-c search_path=wiki,public",
});
await c.connect();
try {
  await c.query("BEGIN");
  let replaced = 0;
  for (const [key, models] of Object.entries(splits)) {
    const rows = await c.query(
      "SELECT DISTINCT cl.id,cl.revision_id,cl.limitations,cc.observation_id,o.title FROM claim cl JOIN claim_citation cc ON cc.claim_id=cl.id JOIN source_observation o ON o.id=cc.observation_id JOIN source s ON s.id=o.source_id JOIN revision r ON r.id=cl.revision_id WHERE s.identity_key=$1 AND cl.origin='ai' AND cl.claim_type='research_summary' AND r.status='draft' AND NOT cl.approved",
      [key],
    );
    for (const original of rows.rows) {
      await c.query("DELETE FROM evidence_record WHERE claim_id=$1", [
        original.id,
      ]);
      await c.query("DELETE FROM claim WHERE id=$1", [original.id]);
      for (const model of models) {
        const claim = (
          await c.query(
            "INSERT INTO claim(revision_id,section,claim_text,claim_type,assertion_scope,evidence_type,limitations,origin) VALUES($1,$2,$3,'model_specific_summary',$4,$5,$6,'ai') RETURNING id",
            [
              original.revision_id,
              model.section,
              model.text,
              model.section === "cell" ? "cell" : model.section,
              model.type,
              original.limitations,
            ],
          )
        ).rows[0];
        await c.query(
          "INSERT INTO claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'Model-specific findings in original report; full passage appraisal pending','supports')",
          [claim.id, original.observation_id],
        );
        const studyKey = `${key}:${model.type}`;
        await c.query(
          "INSERT INTO study(identity_key,study_design,species) VALUES($1,'Model-specific experiment in one report; not independent replication',$2) ON CONFLICT DO NOTHING",
          [studyKey, model.species],
        );
        const study = (
          await c.query("SELECT id FROM study WHERE identity_key=$1", [
            studyKey,
          ])
        ).rows[0];
        await c.query(
          "INSERT INTO evidence_record(revision_id,study_id,observation_id,claim_id,evidence_type,title,summary,finding,confidence,limitations) VALUES($1,$2,$3,$4,$5,$6,$7,$7,'unassessed',$8)",
          [
            original.revision_id,
            study.id,
            original.observation_id,
            claim.id,
            model.type,
            original.title,
            model.text,
            original.limitations,
          ],
        );
      }
      replaced++;
    }
  }
  for (const [key, text] of Object.entries({
    "pmid-15817669":
      "CJC-1295 is a long-acting GHRH analogue designed to bind albumin. This record concerns the albumin-binding molecule, not an unverified retail no-DAC preparation.",
    "pmid-25738459":
      "MOTS-c is a 16-amino-acid peptide described as encoded within a mitochondrial 12S-rRNA open reading frame. Native MOTS-c and related research analogues require separate identities.",
  })) {
    const revisions = await c.query(
      "SELECT DISTINCT cl.revision_id,cc.observation_id FROM claim cl JOIN claim_citation cc ON cc.claim_id=cl.id JOIN source_observation o ON o.id=cc.observation_id JOIN source s ON s.id=o.source_id JOIN revision r ON r.id=cl.revision_id WHERE s.identity_key=$1 AND r.status='draft' AND NOT EXISTS(SELECT 1 FROM claim existing WHERE existing.revision_id=cl.revision_id AND existing.section='overview')",
      [key],
    );
    for (const row of revisions.rows) {
      const identity = (
        await c.query(
          "INSERT INTO claim(revision_id,section,claim_text,claim_type,assertion_scope,evidence_type,limitations,origin) VALUES($1,'overview',$2,'identity_summary','unknown','unknown','Molecular identity and full source appraisal remain subject to human review.','ai') RETURNING id",
          [row.revision_id, text],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'Original report identity and molecular-description sections; verify before approval','supports')",
        [identity.id, row.observation_id],
      );
    }
  }
  await c.query("COMMIT");
  process.stdout.write(
    `Separated model contexts in ${replaced} draft source summaries. No approvals created.\n`,
  );
} catch (error) {
  await c.query("ROLLBACK");
  throw error;
} finally {
  await c.end();
}
