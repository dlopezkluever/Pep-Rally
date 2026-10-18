import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { z } from "zod";
import type { Actor } from "../src/lib/domain";
import { createDisposableDatabase } from "./harness";

let db: Awaited<ReturnType<typeof createDisposableDatabase>>;
let app: pg.Client;
let database: typeof import("../src/lib/db");
let mutate: typeof import("../src/lib/editorial").mutate;
const editor: Actor = {
  id: randomUUID(),
  email: "fixture-editor@localhost",
  display_name: "Synthetic test editor",
  role: "editor",
  is_human: true,
};
const researcher: Actor = {
  id: randomUUID(),
  email: "fixture-researcher@localhost",
  display_name: "Synthetic test researcher",
  role: "researcher",
  is_human: true,
};
let observationId: string;
let taxonomyId: string;

before(
  async () => {
    db = await createDisposableDatabase();
    for (const a of [editor, researcher])
      await db.owner.query(
        "INSERT INTO wiki.actor(id,email,display_name,password_hash,role,is_human) VALUES($1,$2,$3,'disabled',$4,true)",
        [a.id, a.email, a.display_name, a.role],
      );
    const source = z
      .object({ id: z.uuid() })
      .parse(
        (
          await db.owner.query(
            "INSERT INTO wiki.source(identity_key,source_type) VALUES('fixture-source','synthetic_test_source') RETURNING id",
          )
        ).rows[0],
      ).id;
    observationId = z
      .object({ id: z.uuid() })
      .parse(
        (
          await db.owner.query(
            "INSERT INTO wiki.source_observation(source_id,title,url,content_hash,text_scope,license_note) VALUES($1,'Synthetic source for isolated application tests','https://www.fda.gov/','synthetic','regulatory','Synthetic test fixture only') RETURNING id",
            [source],
          )
        ).rows[0],
      ).id;
    taxonomyId = z
      .object({ id: z.uuid() })
      .parse(
        (
          await db.owner.query(
            "INSERT INTO wiki.taxonomy(kind,slug,label) VALUES('area','fixture-biology','Fixture Biology') RETURNING id",
          )
        ).rows[0],
      ).id;
    // Every import of the database module must follow this assignment.
    process.env.DATABASE_URL = db.serverUrl.toString();
    database = await import("../src/lib/db");
    ({ mutate } = await import("../src/lib/editorial"));
    const connected = await database.transaction(
      null,
      async (c) =>
        z
          .object({ name: z.string() })
          .parse((await c.query("SELECT current_database() AS name")).rows[0])
          .name,
    );
    assert.equal(
      connected,
      db.name,
      "tests must run on the disposable database",
    );
    app = new pg.Client({
      connectionString: db.serverUrl.toString(),
      options: "-c search_path=wiki,public",
    });
    await app.connect();
  },
  { timeout: 60000 },
);
after(async () => {
  await app?.end();
  await database?.closeDatabase();
  await db?.drop();
});
async function asActor<T>(actor: Actor, work: () => Promise<T>): Promise<T> {
  await app.query("BEGIN");
  await app.query("SELECT set_config('wiki.actor_id',$1,true)", [actor.id]);
  try {
    const result = await work();
    await app.query("COMMIT");
    return result;
  } catch (error) {
    await app.query("ROLLBACK");
    throw error;
  }
}
const sections = [
  "overview",
  "mechanism",
  "human",
  "animal",
  "cell",
  "trials",
  "safety",
  "unknowns",
  "regulatory",
  "related",
] as const;
const scopeOf = (s: string) =>
  s === "animal"
    ? "animal"
    : s === "cell"
      ? "cell"
      : s === "human"
        ? "human"
        : "regulatory";
const typeOf = (s: string) =>
  s === "animal"
    ? "animal"
    : s === "cell"
      ? "in_vitro"
      : s === "human"
        ? "pilot_human"
        : "regulatory";

/** A fully populated, submitted-for-review revision: every content table has a row. */
async function populated(name: string) {
  const o = db.owner;
  const pid = randomUUID();
  const rid = randomUUID();
  const slug = name.toLowerCase().replaceAll(" ", "-");
  await o.query(
    "INSERT INTO wiki.peptide(id,canonical_name,slug) VALUES($1,$2,$3)",
    [pid, name, slug],
  );
  await o.query(
    "INSERT INTO wiki.revision(id,peptide_id,created_by) VALUES($1,$2,$3)",
    [rid, pid, editor.id],
  );
  await o.query(
    "INSERT INTO wiki.peptide_profile(revision_id,peptide_type) VALUES($1,'Synthetic fixture type')",
    [rid],
  );
  const claims = new Map<string, string>();
  for (const section of sections) {
    const id = randomUUID();
    claims.set(section, id);
    await o.query(
      "INSERT INTO wiki.claim(id,revision_id,section,claim_text,assertion_scope,evidence_type,limitations,origin,plain_text) VALUES($1,$2,$3,$4,$5,$6,'Synthetic isolated fixture, no scientific interpretation.','human',$7)",
      [
        id,
        rid,
        section,
        `${name}: synthetic ${section} statement for software verification only.`,
        scopeOf(section),
        typeOf(section),
        `Plain synthetic ${section} note.`,
      ],
    );
    await o.query(
      "INSERT INTO wiki.claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'Synthetic fixture passage','supports')",
      [id, observationId],
    );
  }
  const study = randomUUID();
  await o.query(
    "INSERT INTO wiki.study(id,identity_key,study_design,species) VALUES($1,$2,'Synthetic design','Synthetic species')",
    [study, `${slug}-study`],
  );
  const evidence = randomUUID();
  await o.query(
    "INSERT INTO wiki.evidence_record(id,revision_id,study_id,observation_id,claim_id,evidence_type,title,summary,finding,year,confidence,limitations) VALUES($1,$2,$3,$4,$5,'animal','Synthetic study title','Synthetic summary text.','Synthetic scoped finding.',2020,'low','Synthetic limitation text.')",
    [evidence, rid, study, observationId, claims.get("animal")],
  );
  await o.query(
    "INSERT INTO wiki.mechanism(revision_id,claim_id,target,pathway,confidence) VALUES($1,$2,'Synthetic target','Synthetic pathway','proposed')",
    [rid, claims.get("mechanism")],
  );
  const trial = randomUUID();
  await o.query(
    "INSERT INTO wiki.clinical_trial(id,registry,registry_id) VALUES($1,'ClinicalTrials.gov',$2)",
    [trial, `NCT${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`],
  );
  await o.query(
    "INSERT INTO wiki.trial_record(revision_id,trial_id,claim_id,observation_id,title,status,results_available,source_url) VALUES($1,$2,$3,$4,'Synthetic trial','COMPLETED',false,'https://clinicaltrials.gov/')",
    [rid, trial, claims.get("trials"), observationId],
  );
  const other = await o.query(
    "INSERT INTO wiki.peptide(canonical_name,slug) VALUES($1,$2) RETURNING id",
    [`${name} Relative`, `${slug}-relative`],
  );
  await o.query(
    "INSERT INTO wiki.peptide_relation(revision_id,related_peptide_id,relation_type,claim_id) VALUES($1,$2,'pathway',$3)",
    [rid, other.rows[0].id, claims.get("related")],
  );
  await o.query(
    "INSERT INTO wiki.revision_taxonomy(revision_id,taxonomy_id,claim_id,label_snapshot) VALUES($1,$2,$3,'Fixture Biology')",
    [rid, taxonomyId, claims.get("overview")],
  );
  await o.query(
    "INSERT INTO wiki.safety_record(revision_id,claim_id,category,severity,evidence_type,known_or_theoretical) VALUES($1,$2,'unknown_long_term_risk','unknown','unknown','unknown')",
    [rid, claims.get("safety")],
  );
  await o.query(
    "INSERT INTO wiki.regulatory_record(revision_id,claim_id,jurisdiction,agency,status,record_type,verified_at,observation_id) VALUES($1,$2,'United States','FDA','unclear','unknown',now(),$3)",
    [rid, claims.get("regulatory"), observationId],
  );
  await asActor(editor, async () => {
    for (const d of [
      "preclinical",
      "human",
      "clinical",
      "safety",
      "regulatory",
    ])
      await app.query(
        "INSERT INTO wiki.evidence_assessment(revision_id,dimension,state,rationale,search_scope,reviewed_by) VALUES($1,$2,'unknown','Synthetic fixture, no real evidence grade assigned.','Isolated software test only',$3)",
        [rid, d, editor.id],
      );
    await app.query(
      "INSERT INTO wiki.assessment_evidence(revision_id,dimension,evidence_id) VALUES($1,'preclinical',$2)",
      [rid, evidence],
    );
    await app.query(
      "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE revision_id=$2",
      [editor.id, rid],
    );
    await app.query(
      "UPDATE wiki.revision SET status='needs_review' WHERE id=$1",
      [rid],
    );
  });
  return { pid, rid, claims, slug, other: other.rows[0].id as string };
}
const publish = (rid: string, reason = "Synthetic fixture publication") =>
  asActor(editor, () =>
    app.query("SELECT wiki.publish_revision($1,$2)", [rid, reason]),
  );
const counts = async (rid: string) =>
  (
    await db.owner.query(
      `SELECT
 (SELECT count(*)::int FROM wiki.peptide_profile WHERE revision_id=$1) AS profile,
 (SELECT count(*)::int FROM wiki.claim WHERE revision_id=$1) AS claims,
 (SELECT count(*)::int FROM wiki.claim_citation cc JOIN wiki.claim c ON c.id=cc.claim_id WHERE c.revision_id=$1) AS citations,
 (SELECT count(*)::int FROM wiki.evidence_record WHERE revision_id=$1) AS evidence,
 (SELECT count(*)::int FROM wiki.evidence_assessment WHERE revision_id=$1) AS assessments,
 (SELECT count(*)::int FROM wiki.assessment_evidence WHERE revision_id=$1) AS links,
 (SELECT count(*)::int FROM wiki.mechanism WHERE revision_id=$1) AS mechanisms,
 (SELECT count(*)::int FROM wiki.revision_taxonomy WHERE revision_id=$1) AS taxonomy,
 (SELECT count(*)::int FROM wiki.trial_record WHERE revision_id=$1) AS trials,
 (SELECT count(*)::int FROM wiki.safety_record WHERE revision_id=$1) AS safety,
 (SELECT count(*)::int FROM wiki.regulatory_record WHERE revision_id=$1) AS regulatory,
 (SELECT count(*)::int FROM wiki.peptide_relation WHERE revision_id=$1) AS relations`,
      [rid],
    )
  ).rows[0];

test("carrying a published revision forward copies content but clears every approval", async () => {
  const f = await populated("Fixture Carry");
  await publish(f.rid);
  const original = await counts(f.rid);
  assert.deepEqual(original, {
    profile: 1,
    claims: 10,
    citations: 10,
    evidence: 1,
    assessments: 5,
    links: 1,
    mechanisms: 1,
    taxonomy: 1,
    trials: 1,
    safety: 1,
    regulatory: 1,
    relations: 1,
  });
  const next = await mutate(researcher, "new_revision", {
    id: f.rid,
    carry: "forward",
  });
  assert.deepEqual(await counts(next), original);
  const trust = await db.owner.query(
    `SELECT
 (SELECT count(*)::int FROM wiki.claim WHERE revision_id=$1 AND (approved OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_note IS NOT NULL)) AS trusted_claims,
 (SELECT count(*)::int FROM wiki.evidence_assessment WHERE revision_id=$1 AND reviewed_by IS NOT NULL) AS reviewed_assessments,
 (SELECT count(*)::int FROM wiki.claim a JOIN wiki.claim b ON a.id=b.id WHERE a.revision_id=$1 AND b.revision_id=$2) AS shared_claim_ids`,
    [next, f.rid],
  );
  assert.deepEqual(trust.rows[0], {
    trusted_claims: 0,
    reviewed_assessments: 0,
    shared_claim_ids: 0,
  });
  // Child rows reference the new revision's claims, not the published ones.
  const crossed = await db.owner.query(
    `SELECT count(*)::int AS n FROM wiki.evidence_record e JOIN wiki.claim c ON c.id=e.claim_id WHERE e.revision_id=$1 AND c.revision_id<>$1`,
    [next],
  );
  assert.equal(crossed.rows[0].n, 0);
  const wording = await db.owner.query(
    `SELECT a.claim_text=b.claim_text AND a.plain_text=b.plain_text AND a.section=b.section AND a.evidence_type=b.evidence_type AND a.assertion_scope=b.assertion_scope AND a.limitations=b.limitations AS same
 FROM wiki.claim a JOIN wiki.claim b ON b.claim_text=a.claim_text AND b.section=a.section WHERE a.revision_id=$1 AND b.revision_id=$2`,
    [f.rid, next],
  );
  assert.equal(wording.rowCount, 10);
  assert.ok(wording.rows.every((r) => r.same));
  // The published original is untouched and still public.
  const original2 = await db.owner.query(
    "SELECT r.status,(SELECT count(*)::int FROM wiki.claim WHERE revision_id=r.id AND approved) AS approved FROM wiki.revision r WHERE r.id=$1",
    [f.rid],
  );
  assert.deepEqual(original2.rows[0], { status: "published", approved: 10 });
  const active = await db.owner.query(
    "SELECT p.revision_id FROM wiki.active_publication a JOIN wiki.publication p ON p.id=a.publication_id WHERE a.peptide_id=$1",
    [f.pid],
  );
  assert.equal(active.rows[0].revision_id, f.rid);

  // Carried content cannot publish on the strength of earlier approvals.
  await asActor(editor, () =>
    app.query("UPDATE wiki.revision SET status='needs_review' WHERE id=$1", [
      next,
    ]),
  );
  await assert.rejects(publish(next), /human approval/);
  await asActor(editor, () =>
    app.query(
      "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE revision_id=$2",
      [editor.id, next],
    ),
  );
  await assert.rejects(publish(next), /Five reviewed evidence dimensions/);
  // After a human re-reviews claims and assessments, the copy publishes and replaces the original.
  await asActor(editor, () =>
    app.query(
      "UPDATE wiki.evidence_assessment SET reviewed_by=$1 WHERE revision_id=$2",
      [editor.id, next],
    ),
  );
  await publish(next, "Synthetic re-reviewed revision");
  const after = await db.owner.query(
    "SELECT p.revision_id FROM wiki.active_publication a JOIN wiki.publication p ON p.id=a.publication_id WHERE a.peptide_id=$1",
    [f.pid],
  );
  assert.equal(after.rows[0].revision_id, next);

  // Only one open draft per peptide, and a blank revision stays available.
  const blank = await mutate(researcher, "new_revision", { id: next });
  assert.deepEqual((await counts(blank)).claims, 0);
  await assert.rejects(
    mutate(researcher, "new_revision", { id: next, carry: "forward" }),
    /already has an open revision/,
  );
});

test("carry forward refuses unrelated revisions and non-empty targets", async () => {
  const a = await populated("Fixture Lineage A");
  const b = await populated("Fixture Lineage B");
  await assert.rejects(
    asActor(researcher, () =>
      app.query("SELECT wiki.carry_forward_revision($1,$2)", [a.rid, b.rid]),
    ),
    /descends from the source/,
  );
  await publish(a.rid);
  const child = randomUUID();
  await db.owner.query(
    "INSERT INTO wiki.revision(id,peptide_id,parent_id) VALUES($1,$2,$3)",
    [child, a.pid, a.rid],
  );
  await db.owner.query(
    "INSERT INTO wiki.claim(revision_id,section,claim_text,assertion_scope,origin) VALUES($1,'overview','Synthetic existing draft claim.','unknown','human')",
    [child],
  );
  await assert.rejects(
    asActor(researcher, () =>
      app.query("SELECT wiki.carry_forward_revision($1,$2)", [a.rid, child]),
    ),
    /already has content/,
  );
  // Anonymous callers cannot reach published or draft content to copy.
  await assert.rejects(
    app.query("SELECT wiki.carry_forward_revision($1,$2)", [a.rid, child]),
  );
});

test("related peptides are linked through a sourced claim and never to themselves", async () => {
  const f = await populated("Fixture Relations");
  await publish(f.rid);
  const draft = await mutate(researcher, "new_revision", {
    id: f.rid,
    carry: "forward",
  });
  const claim = (
    await db.owner.query(
      "SELECT id FROM wiki.claim WHERE revision_id=$1 AND section='related'",
      [draft],
    )
  ).rows[0].id;
  const second = await db.owner.query(
    "INSERT INTO wiki.peptide(canonical_name,slug) VALUES('Fixture Second Relative','fixture-second-relative') RETURNING id",
  );
  await mutate(researcher, "relation", {
    revisionId: draft,
    claimId: claim,
    relatedPeptideId: second.rows[0].id,
    type: "structural",
  });
  assert.equal((await counts(draft)).relations, 2);
  await assert.rejects(
    mutate(researcher, "relation", {
      revisionId: draft,
      claimId: claim,
      relatedPeptideId: f.pid,
      type: "pathway",
    }),
    /cannot be related to itself/,
  );
  await assert.rejects(
    mutate(researcher, "relation", {
      revisionId: draft,
      claimId: claim,
      relatedPeptideId: second.rows[0].id,
      type: "not-a-type",
    }),
  );
});
