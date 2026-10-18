import pg from "pg";
import { createHash } from "node:crypto";
import { z } from "zod";
import { fetchOfficial } from "../src/lib/research";
import { closeDatabase } from "../src/lib/db";
const input = z.object({
  hasResults: z.boolean(),
  protocolSection: z.object({
    identificationModule: z.object({
      nctId: z.string(),
      briefTitle: z.string(),
    }),
    statusModule: z.object({
      overallStatus: z.string(),
      startDateStruct: z.object({ date: z.string() }).optional(),
      completionDateStruct: z.object({ date: z.string() }).optional(),
    }),
    designModule: z.object({
      phases: z.array(z.string()).optional(),
      enrollmentInfo: z
        .object({ count: z.number(), type: z.string().optional() })
        .optional(),
    }),
    eligibilityModule: z
      .object({ eligibilityCriteria: z.string().optional() })
      .optional(),
    armsInterventionsModule: z
      .object({
        interventions: z.array(z.object({ name: z.string() })).optional(),
      })
      .optional(),
    outcomesModule: z
      .object({
        primaryOutcomes: z.array(z.object({ measure: z.string() })).optional(),
      })
      .optional(),
  }),
});
const c = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  options: "-c search_path=wiki,public",
});
await c.connect();
const seeds = [
  ["semaglutide", "NCT03548935"],
  ["cjc-1295", "NCT00267527"],
  ["kisspeptin-54", "NCT01667406"],
  ["mots-c", "NCT07505745"],
];
try {
  for (const [slug, nct] of seeds) {
    const revision = z
      .object({ id: z.uuid() })
      .parse(
        (
          await c.query(
            "SELECT r.id FROM wiki.revision r JOIN wiki.peptide p ON p.id=r.peptide_id WHERE p.slug=$1 AND r.status='draft' ORDER BY r.created_at LIMIT 1",
            [slug],
          )
        ).rows[0],
      );
    if (
      (
        await c.query(
          "SELECT 1 FROM wiki.trial_record r JOIN wiki.clinical_trial t ON t.id=r.trial_id WHERE r.revision_id=$1 AND t.registry_id=$2",
          [revision.id, nct],
        )
      ).rowCount
    )
      continue;
    const data = input.parse(
      await fetchOfficial(
        new URL(`https://clinicaltrials.gov/api/v2/studies/${nct}`),
      ),
    );
    const p = data.protocolSection;
    const hash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    await c.query("BEGIN");
    await c.query(
      "INSERT INTO source(identity_key,source_type) VALUES($1,'trial_registry') ON CONFLICT DO NOTHING",
      [`ctgov-${nct}`],
    );
    const sid = z
      .object({ id: z.uuid() })
      .parse(
        (
          await c.query("SELECT id FROM source WHERE identity_key=$1", [
            `ctgov-${nct}`,
          ])
        ).rows[0],
      ).id;
    await c.query(
      "INSERT INTO source_observation(source_id,title,url,content_hash,text_scope,license_note,notes) VALUES($1,$2,$3,$4,'registry','Selected structured registry metadata for private editorial review; current source terms require final review.',$5) ON CONFLICT DO NOTHING",
      [
        sid,
        p.identificationModule.briefTitle,
        `https://clinicaltrials.gov/study/${nct}`,
        hash,
        JSON.stringify(data),
      ],
    );
    const oid = z
      .object({ id: z.uuid() })
      .parse(
        (
          await c.query(
            "SELECT id FROM source_observation WHERE source_id=$1 AND content_hash=$2",
            [sid, hash],
          )
        ).rows[0],
      ).id;
    const claimId = z
      .object({ id: z.uuid() })
      .parse(
        (
          await c.query(
            "INSERT INTO claim(revision_id,section,claim_text,assertion_scope,evidence_type,limitations,origin) VALUES($1,'trials',$2,'unknown','clinical_trial',$3,'import') RETURNING id",
            [
              revision.id,
              `Registry ${nct} reports ${p.statusModule.overallStatus.replaceAll("_", " ")} status. ${data.hasResults ? "Results are posted in the registry." : "No posted registry results are present in this snapshot."}`,
              "Sponsor-submitted registration does not establish study conduct, efficacy, safety, molecular equivalence, or FDA authorization. Enrollment can be estimated; publication cohorts may differ.",
            ],
          )
        ).rows[0],
      ).id;
    await c.query(
      "INSERT INTO claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'protocolSection.statusModule, designModule, and hasResults','supports')",
      [claimId, oid],
    );
    await c.query(
      "INSERT INTO clinical_trial(registry,registry_id) VALUES('ClinicalTrials.gov',$1) ON CONFLICT DO NOTHING",
      [nct],
    );
    const trial = z
      .object({ id: z.uuid() })
      .parse(
        (
          await c.query(
            "SELECT id FROM clinical_trial WHERE registry='ClinicalTrials.gov' AND registry_id=$1",
            [nct],
          )
        ).rows[0],
      );
    const date = (d: string | undefined) =>
      d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    await c.query(
      "INSERT INTO trial_record(revision_id,trial_id,claim_id,observation_id,title,phase,status,enrollment,enrollment_type,population,intervention,primary_outcomes,start_date,completion_date,results_available,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
      [
        revision.id,
        trial.id,
        claimId,
        oid,
        p.identificationModule.briefTitle,
        p.designModule.phases?.join(", ") ?? null,
        p.statusModule.overallStatus,
        p.designModule.enrollmentInfo?.count ?? null,
        p.designModule.enrollmentInfo?.type ?? null,
        p.eligibilityModule?.eligibilityCriteria?.slice(0, 4000) ?? null,
        p.armsInterventionsModule?.interventions
          ?.map((i) => i.name)
          .join("; ") ?? null,
        p.outcomesModule?.primaryOutcomes?.map((o) => o.measure).join("; ") ??
          null,
        date(p.statusModule.startDateStruct?.date),
        date(p.statusModule.completionDateStruct?.date),
        data.hasResults ?? false,
        `https://clinicaltrials.gov/study/${nct}`,
      ],
    );
    await c.query("COMMIT");
    process.stdout.write(`Imported draft registry snapshot ${nct}.\n`);
  }
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
  await closeDatabase();
}
