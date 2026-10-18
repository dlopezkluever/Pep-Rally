import { z } from "zod";
import { transaction, value } from "./db";
import {
  type Actor,
  claimInputSchema,
  gradeSchema,
  knowledgeSchema,
} from "./domain";
import { createHash } from "node:crypto";
import { evidenceType } from "./domain";

export const queueSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  revision_id: z.uuid(),
  status: z.string(),
  updated_at: z.string(),
  claims: z.number(),
  approved: z.number(),
  open_flags: z.number(),
});
export async function queue(actor: Actor) {
  return value(
    `SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY name),'[]') AS data FROM (
 SELECT p.id,p.slug,p.canonical_name AS name,r.id AS revision_id,r.status,r.updated_at,
 (SELECT count(*)::int FROM claim WHERE revision_id=r.id) AS claims,
 (SELECT count(*)::int FROM claim WHERE revision_id=r.id AND approved) AS approved,
 (SELECT count(*)::int FROM claim_flag WHERE revision_id=r.id AND resolved_by IS NULL) AS open_flags
 FROM peptide p JOIN LATERAL(SELECT * FROM revision WHERE peptide_id=p.id ORDER BY created_at DESC LIMIT 1) r ON true) x`,
    [],
    z.array(queueSchema),
    actor.id,
  );
}
export async function sources(actor: Actor) {
  return value(
    `SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY title),'[]') AS data FROM (SELECT o.id,o.title,o.url,o.retrieved_at,o.text_scope,o.notes,o.source_text,o.license_note,(SELECT count(*)::int FROM claim_citation WHERE observation_id=o.id) AS claims FROM source_observation o ORDER BY retrieved_at DESC LIMIT 100) x`,
    [],
    z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        url: z.url(),
        retrieved_at: z.string(),
        text_scope: z.string(),
        notes: z.string().nullable(),
        source_text: z.string().nullable(),
        license_note: z.string(),
        claims: z.number(),
      }),
    ),
    actor.id,
  );
}
const assessmentInput = z.object({
  revisionId: z.uuid(),
  dimension: z.enum([
    "preclinical",
    "human",
    "clinical",
    "safety",
    "regulatory",
  ]),
  state: knowledgeSchema,
  grade: gradeSchema.or(z.literal("")),
  rationale: z.string().trim().min(20).max(4000),
  searchScope: z.string().trim().min(10).max(3000),
  searchDate: z.string().optional(),
});
export async function mutate(
  actor: Actor,
  operation: string,
  input: Record<string, unknown>,
) {
  if (!["researcher", "editor", "admin"].includes(actor.role))
    throw new Error("Researcher role required");
  return transaction(actor.id, async (c) => {
    const editor = () => {
      if (!actor.is_human || !["editor", "admin"].includes(actor.role))
        throw new Error("Human editor role required");
    };
    const id = () => z.uuid().parse(input.id);
    const reason = () =>
      z.string().trim().min(10).max(3000).parse(input.reason);
    const currentRevision = async (target: string, byClaim = false) => {
      const expected = z.string().min(10).parse(input.expectedUpdatedAt);
      const result = await c.query(
        "SELECT r.updated_at=$2::timestamptz AS matches FROM wiki.revision r WHERE r.id=CASE WHEN $3 THEN (SELECT revision_id FROM wiki.claim WHERE id=$1) ELSE $1 END FOR UPDATE",
        [target, expected, byClaim],
      );
      if (!z.object({ matches: z.boolean() }).parse(result.rows[0]).matches)
        throw new Error("Draft changed. Reload before reviewing or saving.");
    };
    let target: string;
    switch (operation) {
      case "create": {
        const name = z.string().trim().min(2).max(120).parse(input.name);
        const slug = z
          .string()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
          .max(120)
          .parse(input.slug);
        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (
          (
            await c.query(
              "SELECT 1 FROM wiki.peptide_alias WHERE normalized=$1 LIMIT 1",
              [normalized],
            )
          ).rowCount
        )
          throw new Error(
            "This name is an existing alias. Resolve the existing identity first.",
          );
        const r = await c.query(
          "INSERT INTO wiki.peptide(canonical_name,slug) VALUES($1,$2) RETURNING id",
          [name, slug],
        );
        const pid = z.object({ id: z.uuid() }).parse(r.rows[0]).id;
        const rev = await c.query(
          "INSERT INTO wiki.revision(peptide_id,created_by) VALUES($1,$2) RETURNING id",
          [pid, actor.id],
        );
        target = z.object({ id: z.uuid() }).parse(rev.rows[0]).id;
        break;
      }
      case "new_revision": {
        const old = await c.query(
          "SELECT peptide_id FROM wiki.revision WHERE id=$1",
          [id()],
        );
        const pid = z
          .object({ peptide_id: z.uuid() })
          .parse(old.rows[0]).peptide_id;
        // One open draft per peptide keeps the queue and the carried-forward lineage unambiguous.
        if (
          (
            await c.query(
              "SELECT 1 FROM wiki.revision WHERE peptide_id=$1 AND status IN ('unresearched','researching','draft','needs_review') LIMIT 1",
              [pid],
            )
          ).rowCount
        )
          throw new Error(
            "This peptide already has an open revision. Continue that draft instead.",
          );
        const rev = await c.query(
          "INSERT INTO wiki.revision(peptide_id,parent_id,created_by) VALUES($1,$2,$3) RETURNING id",
          [pid, id(), actor.id],
        );
        target = z.object({ id: z.uuid() }).parse(rev.rows[0]).id;
        if (input.carry === "forward")
          await c.query("SELECT wiki.carry_forward_revision($1,$2)", [
            id(),
            target,
          ]);
        break;
      }
      case "source": {
        const data = z
          .object({
            title: z.string().trim().min(5).max(500),
            url: z.url().refine((v) => v.startsWith("https://")),
            identity: z.string().trim().min(3).max(200),
            scope: z.enum([
              "metadata",
              "abstract",
              "full_text",
              "registry",
              "regulatory",
            ]),
            text: z.string().max(100000),
            permission: z.string().trim().min(10).max(2000),
          })
          .parse(input);
        const hash = createHash("sha256")
          .update(JSON.stringify(data))
          .digest("hex");
        await c.query(
          "INSERT INTO wiki.source(identity_key,source_type) VALUES($1,'manual_primary_source') ON CONFLICT DO NOTHING",
          [data.identity],
        );
        const source = z
          .object({ id: z.uuid() })
          .parse(
            (
              await c.query(
                "SELECT id FROM wiki.source WHERE identity_key=$1",
                [data.identity],
              )
            ).rows[0],
          );
        const result = await c.query(
          "INSERT INTO wiki.source_observation(source_id,title,url,content_hash,text_scope,source_text,license_note,text_permission_basis) VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(source_id,content_hash) DO NOTHING RETURNING id",
          [
            source.id,
            data.title,
            data.url,
            hash,
            data.scope,
            data.text || null,
            data.permission,
          ],
        );
        target = result.rows.length
          ? z.object({ id: z.uuid() }).parse(result.rows[0]).id
          : source.id;
        break;
      }
      case "edit_claim": {
        target = id();
        await currentRevision(target, true);
        const text = z.string().trim().min(10).max(6000).parse(input.text);
        await c.query(
          "UPDATE wiki.claim SET claim_text=$1,plain_text=$2,limitations=$3 WHERE id=$4",
          [
            text,
            z.string().max(6000).parse(input.plainText) || null,
            z.string().min(5).max(3000).parse(input.limitations),
            target,
          ],
        );
        break;
      }
      case "delete_claim":
        target = id();
        await c.query("DELETE FROM wiki.claim WHERE id=$1", [target]);
        break;
      case "alias": {
        target = z.uuid().parse(input.peptideId);
        await c.query(
          "INSERT INTO wiki.peptide_alias(peptide_id,alias,alias_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [
            target,
            z.string().trim().min(2).max(120).parse(input.alias),
            z
              .enum([
                "scientific",
                "commercial",
                "research_code",
                "abbreviation",
                "legacy_name",
              ])
              .parse(input.aliasType),
          ],
        );
        break;
      }
      case "evidence": {
        const raw = input.payload
          ? JSON.parse(z.string().parse(input.payload))
          : {
              ...input,
              sampleSize: input.sampleSize ? Number(input.sampleSize) : null,
              year: input.year ? Number(input.year) : null,
              species: input.species || null,
              population: input.population || null,
            };
        const payload = z
          .object({
            revisionId: z.uuid(),
            claimId: z.uuid(),
            observationId: z.uuid(),
            studyKey: z.string().min(3),
            studyDesign: z.string(),
            species: z.string().nullable(),
            population: z.string().nullable(),
            sampleSize: z.number().int().positive().nullable(),
            type: evidenceType,
            title: z.string().min(5),
            summary: z.string().min(10),
            finding: z.string().min(10),
            limitations: z.string().min(10),
            confidence: z.string().min(3),
            year: z.number().int().min(1800).max(2200).nullable(),
          })
          .parse(raw);
        target = payload.revisionId;
        await c.query(
          "INSERT INTO wiki.study(identity_key,study_design,species,population,sample_size) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [
            payload.studyKey,
            payload.studyDesign,
            payload.species,
            payload.population,
            payload.sampleSize,
          ],
        );
        const study = z
          .object({ id: z.uuid() })
          .parse(
            (
              await c.query("SELECT id FROM wiki.study WHERE identity_key=$1", [
                payload.studyKey,
              ])
            ).rows[0],
          );
        await c.query(
          "INSERT INTO wiki.evidence_record(revision_id,study_id,observation_id,claim_id,evidence_type,title,summary,finding,year,confidence,limitations) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            target,
            study.id,
            payload.observationId,
            payload.claimId,
            payload.type,
            payload.title,
            payload.summary,
            payload.finding,
            payload.year,
            payload.confidence,
            payload.limitations,
          ],
        );
        break;
      }
      case "mechanism": {
        const payload = z
          .object({
            revisionId: z.uuid(),
            claimId: z.uuid(),
            target: z.string(),
            pathway: z.string(),
            confidence: z.enum([
              "established",
              "supported_hypothesis",
              "proposed",
              "unknown",
            ]),
          })
          .parse(
            input.payload ? JSON.parse(z.string().parse(input.payload)) : input,
          );
        target = payload.revisionId;
        await c.query(
          "INSERT INTO wiki.mechanism(revision_id,claim_id,target,pathway,confidence) VALUES($1,$2,$3,$4,$5)",
          [
            target,
            payload.claimId,
            payload.target,
            payload.pathway,
            payload.confidence,
          ],
        );
        break;
      }
      case "relation": {
        const payload = z
          .object({
            revisionId: z.uuid(),
            claimId: z.uuid(),
            relatedPeptideId: z.uuid(),
            type: z.enum([
              "receptor_family",
              "pathway",
              "peptide_family",
              "research_area",
              "structural",
            ]),
          })
          .parse(
            input.payload ? JSON.parse(z.string().parse(input.payload)) : input,
          );
        target = payload.revisionId;
        await c.query(
          "INSERT INTO wiki.peptide_relation(revision_id,related_peptide_id,relation_type,claim_id) VALUES($1,$2,$3,$4)",
          [target, payload.relatedPeptideId, payload.type, payload.claimId],
        );
        break;
      }
      case "claim": {
        const data = claimInputSchema.parse(input);
        const locked = await c.query(
          "SELECT updated_at FROM wiki.revision WHERE id=$1 FOR UPDATE",
          [data.revisionId],
        );
        const updated = z
          .object({ updated_at: z.date() })
          .parse(locked.rows[0]).updated_at;
        if (
          updated.toISOString() !==
          new Date(data.expectedUpdatedAt).toISOString()
        )
          throw new Error("Draft changed. Reload before saving.");
        const result = await c.query(
          "INSERT INTO wiki.claim(revision_id,section,claim_text,plain_text,assertion_scope,evidence_type,limitations,origin) VALUES($1,$2,$3,$4,$5,$6,$7,'human') RETURNING id",
          [
            data.revisionId,
            data.section,
            data.text,
            data.plainText || null,
            data.scope,
            data.evidenceType,
            data.limitations,
          ],
        );
        const cid = z.object({ id: z.uuid() }).parse(result.rows[0]).id;
        await c.query(
          "INSERT INTO wiki.claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,$3,'supports')",
          [cid, data.observationId, data.locator],
        );
        await c.query(
          "UPDATE wiki.revision SET updated_at=clock_timestamp() WHERE id=$1",
          [data.revisionId],
        );
        target = data.revisionId;
        break;
      }
      case "review": {
        editor();
        target = id();
        await currentRevision(target, true);
        const approved =
          z.enum(["approve", "reject"]).parse(input.decision) === "approve";
        await c.query(
          "UPDATE wiki.claim SET approved=$1,reviewed_by=$2,reviewed_at=now(),review_note=$3 WHERE id=$4",
          [approved, actor.id, reason(), target],
        );
        break;
      }
      case "resolve_flag": {
        editor();
        target = id();
        await c.query(
          "UPDATE wiki.claim_flag SET resolved_by=$1,resolved_at=now(),resolution=$2 WHERE id=$3",
          [actor.id, reason(), target],
        );
        break;
      }
      case "assessment": {
        editor();
        const data = assessmentInput.parse(input);
        target = data.revisionId;
        if (data.state !== "known" && data.grade)
          throw new Error("Unknown evidence cannot have a grade");
        await c.query(
          `INSERT INTO wiki.evidence_assessment(revision_id,dimension,state,grade,rationale,search_scope,search_completed_at,reviewed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(revision_id,dimension) DO UPDATE SET state=excluded.state,grade=excluded.grade,rationale=excluded.rationale,search_scope=excluded.search_scope,search_completed_at=excluded.search_completed_at,reviewed_by=excluded.reviewed_by`,
          [
            target,
            data.dimension,
            data.state,
            data.grade || null,
            data.rationale,
            data.searchScope,
            data.searchDate || null,
            actor.id,
          ],
        );
        break;
      }
      case "safety": {
        target = z.uuid().parse(input.revisionId);
        const claimId = z.uuid().parse(input.claimId);
        const category = z
          .enum([
            "adverse_event",
            "toxicity",
            "drug_interaction",
            "contraindication",
            "regulatory_warning",
            "unknown_long_term_risk",
            "immunogenicity",
            "contamination_risk",
          ])
          .parse(input.category);
        const known = z
          .enum(["observed", "theoretical", "unknown"])
          .parse(input.known);
        await c.query(
          "INSERT INTO wiki.safety_record(revision_id,claim_id,category,severity,evidence_type,known_or_theoretical) SELECT $1,$2,$3,$4,evidence_type,$5 FROM wiki.claim WHERE id=$2 AND revision_id=$1",
          [
            target,
            claimId,
            category,
            z.string().min(2).max(200).parse(input.severity),
            known,
          ],
        );
        break;
      }
      case "regulatory": {
        target = z.uuid().parse(input.revisionId);
        await c.query(
          "INSERT INTO wiki.regulatory_record(revision_id,claim_id,jurisdiction,agency,status,record_type,product,indication,verified_at,observation_id) VALUES($1,$2,'United States','FDA',$3,$4,$5,$6,now(),$7)",
          [
            target,
            z.uuid().parse(input.claimId),
            z
              .enum(["approved", "investigational", "not_approved", "unclear"])
              .parse(input.status),
            z
              .enum([
                "drug_approval",
                "investigational",
                "compounding",
                "warning",
                "unknown",
              ])
              .parse(input.recordType),
            z.string().max(500).parse(input.product),
            z.string().max(3000).parse(input.indication),
            z.uuid().parse(input.observationId),
          ],
        );
        break;
      }
      case "submit":
        target = id();
        await c.query(
          "UPDATE wiki.revision SET status='needs_review',updated_at=clock_timestamp() WHERE id=$1 AND status IN ('draft','researching','unresearched')",
          [target],
        );
        break;
      case "publish":
        editor();
        target = id();
        await currentRevision(target);
        await c.query("SELECT wiki.publish_revision($1,$2)", [
          target,
          reason(),
        ]);
        break;
      case "withdraw":
        editor();
        target = id();
        await c.query("SELECT wiki.withdraw_publication($1,$2)", [
          target,
          reason(),
        ]);
        break;
      case "archive":
        editor();
        target = id();
        await c.query(
          "UPDATE wiki.revision SET status='archived' WHERE id=$1 AND status NOT IN ('published','approved')",
          [target],
        );
        break;
      case "discover": {
        target = id();
        const rev = await c.query(
          "SELECT peptide_id FROM wiki.revision WHERE id=$1",
          [target],
        );
        const pid = z
          .object({ peptide_id: z.uuid() })
          .parse(rev.rows[0]).peptide_id;
        await c.query(
          "INSERT INTO wiki.research_job(peptide_id,revision_id,requested_by,kind,dedupe_key) VALUES($1,$2,$3,'discover',$4) ON CONFLICT DO NOTHING",
          [
            pid,
            target,
            actor.id,
            `${target}:discover:${new Date().toISOString().slice(0, 10)}`,
          ],
        );
        break;
      }
      case "taxonomy": {
        editor();
        target = actor.id;
        await c.query(
          "INSERT INTO wiki.taxonomy(kind,slug,label) VALUES($1,$2,$3) ON CONFLICT(kind,slug) DO UPDATE SET label=excluded.label",
          [
            z.enum(["area", "family"]).parse(input.kind),
            z
              .string()
              .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
              .parse(input.slug),
            z.string().min(2).max(100).parse(input.label),
          ],
        );
        break;
      }
      case "associate": {
        target = z.uuid().parse(input.revisionId);
        await c.query(
          "INSERT INTO wiki.revision_taxonomy(revision_id,taxonomy_id,claim_id,label_snapshot) SELECT $1,id,$2,label FROM wiki.taxonomy WHERE slug=$3 AND kind=$4",
          [
            target,
            z.uuid().parse(input.claimId),
            z.string().parse(input.slug),
            z.enum(["area", "family"]).parse(input.kind),
          ],
        );
        break;
      }
      default:
        throw new Error("Unknown operation");
    }
    await c.query("SELECT wiki.log_action($1,$2,$3,$4)", [
      operation,
      target,
      typeof input.reason === "string"
        ? input.reason
        : "Authenticated editorial operation",
      JSON.stringify(input),
    ]);
    return target;
  });
}
