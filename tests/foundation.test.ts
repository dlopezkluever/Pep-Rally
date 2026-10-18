import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import pg from "pg";
import { z } from "zod";
import { chromium, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  normalizeName,
  normalizeDoi,
  detectLanguage,
  canSupportScope,
  type Actor,
} from "../src/lib/domain";

const databaseName = `peppy_verify_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(z.string().parse(process.env.MIGRATION_DATABASE_URL));
const verificationUrl = new URL(adminUrl);
verificationUrl.pathname = `/${databaseName}`;
const serverUrl = new URL(z.string().parse(process.env.DATABASE_URL));
serverUrl.pathname = `/${databaseName}`;
let owner: pg.Client;
let app: pg.Client;
let child: ChildProcess | undefined;
let browser: Browser | undefined;
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
const password = randomBytes(24).toString("hex");
let observationId: string;
let taxonomyId: string;
let output = "";
const base = "http://127.0.0.1:3049";

before(
  async () => {
    const root = new pg.Client({ connectionString: adminUrl.toString() });
    await root.connect();
    await root.query(`CREATE DATABASE "${databaseName}"`);
    await root.end();
    owner = new pg.Client({
      connectionString: verificationUrl.toString(),
      options: "-c search_path=wiki,public",
    });
    await owner.connect();
    const migrate = () =>
      new Promise<void>((resolve, reject) =>
        execFile(
          process.execPath,
          ["scripts/migrate.mjs"],
          {
            env: {
              ...process.env,
              MIGRATION_DATABASE_URL: verificationUrl.toString(),
            },
            windowsHide: true,
          },
          (error) => (error ? reject(error) : resolve()),
        ),
      );
    await migrate();
    await migrate();
    const salt = randomBytes(16).toString("hex");
    const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    for (const a of [editor, researcher])
      await owner.query(
        "INSERT INTO wiki.actor(id,email,display_name,password_hash,role,is_human) VALUES($1,$2,$3,$4,$5,$6)",
        [a.id, a.email, a.display_name, hash, a.role, a.is_human],
      );
    const workerId = randomUUID();
    await owner.query(
      "INSERT INTO wiki.actor(id,email,display_name,password_hash,role,is_human) VALUES($1,'worker@internal','Synthetic worker','disabled','researcher',false)",
      [workerId],
    );
    await owner.query(
      "INSERT INTO wiki.runtime_identity(login_name,actor_id) VALUES('peppy_worker',$1)",
      [workerId],
    );
    const sid = z
      .object({ id: z.uuid() })
      .parse(
        (
          await owner.query(
            "INSERT INTO wiki.source(identity_key,source_type) VALUES('fixture-source','synthetic_test_source') RETURNING id",
          )
        ).rows[0],
      ).id;
    observationId = z
      .object({ id: z.uuid() })
      .parse(
        (
          await owner.query(
            "INSERT INTO wiki.source_observation(source_id,title,url,content_hash,text_scope,license_note,source_text,text_permission_basis) VALUES($1,'Synthetic source for isolated application tests','https://www.fda.gov/','synthetic','regulatory','Synthetic test fixture only','Synthetic source text has no scientific meaning.','Original synthetic text created for testing.') RETURNING id",
            [sid],
          )
        ).rows[0],
      ).id;
    taxonomyId = z
      .object({ id: z.uuid() })
      .parse(
        (
          await owner.query(
            "INSERT INTO wiki.taxonomy(kind,slug,label) VALUES('area','fixture-biology','Fixture Biology') RETURNING id",
          )
        ).rows[0],
      ).id;
    app = new pg.Client({
      connectionString: serverUrl.toString(),
      options: "-c search_path=wiki,public",
    });
    await app.connect();
    process.env.DATABASE_URL = serverUrl.toString();
  },
  { timeout: 60000 },
);
after(async () => {
  await browser?.close();
  child?.kill();
  if (child)
    await new Promise<void>((resolve) => {
      if (child?.exitCode !== null) return resolve();
      child?.once("exit", () => resolve());
      setTimeout(resolve, 5000);
    });
  const { closeDatabase } = await import("../src/lib/db");
  await closeDatabase();
  await app?.end();
  await owner?.end();
  const root = new pg.Client({ connectionString: adminUrl.toString() });
  await root.connect();
  await root.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
    [databaseName],
  );
  await root.query(`DROP DATABASE "${databaseName}"`);
  await root.end();
});
async function asActor<T>(
  actor: Actor | null,
  work: () => Promise<T>,
): Promise<T> {
  await app.query("BEGIN");
  await app.query("SELECT set_config('wiki.actor_id',$1,true)", [
    actor?.id ?? "",
  ]);
  try {
    const result = await work();
    await app.query("COMMIT");
    return result;
  } catch (error) {
    await app.query("ROLLBACK");
    throw error;
  }
}
async function fixture(name: string) {
  const pid = randomUUID(),
    rid = randomUUID();
  await owner.query(
    "INSERT INTO wiki.peptide(id,canonical_name,slug) VALUES($1,$2,$3)",
    [pid, name, name.toLowerCase().replaceAll(" ", "-")],
  );
  await owner.query(
    "INSERT INTO wiki.peptide_alias(peptide_id,alias,alias_type) VALUES($1,$2,'research_code')",
    [pid, name.replaceAll(" ", "")],
  );
  await owner.query(
    "INSERT INTO wiki.revision(id,peptide_id,created_by) VALUES($1,$2,$3)",
    [rid, pid, editor.id],
  );
  const claims = new Map<string, string>();
  for (const section of [
    "overview",
    "human",
    "animal",
    "cell",
    "safety",
    "unknowns",
    "regulatory",
  ]) {
    const id = randomUUID();
    claims.set(section, id);
    const type =
      section === "animal"
        ? "animal"
        : section === "cell"
          ? "in_vitro"
          : section === "human"
            ? "pilot_human"
            : "regulatory";
    const scope =
      section === "animal"
        ? "animal"
        : section === "cell"
          ? "cell"
          : section === "human"
            ? "human"
            : "regulatory";
    await owner.query(
      "INSERT INTO wiki.claim(id,revision_id,section,claim_text,assertion_scope,evidence_type,limitations,origin) VALUES($1,$2,$3,$4,$5,$6,'Synthetic isolated fixture, no scientific interpretation.','human')",
      [
        id,
        rid,
        section,
        `${name}: synthetic ${section} statement for software verification only.`,
        scope,
        type,
      ],
    );
    await owner.query(
      "INSERT INTO wiki.claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'Synthetic fixture passage','supports')",
      [id, observationId],
    );
  }
  await asActor(editor, async () => {
    await app.query(
      "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE revision_id=$2",
      [editor.id, rid],
    );
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
      "INSERT INTO wiki.safety_record(revision_id,claim_id,category,severity,evidence_type,known_or_theoretical) VALUES($1,$2,'unknown_long_term_risk','unknown','unknown','unknown')",
      [rid, claims.get("safety")],
    );
    await app.query(
      "INSERT INTO wiki.regulatory_record(revision_id,claim_id,jurisdiction,agency,status,record_type,verified_at,observation_id) VALUES($1,$2,'United States','FDA','unclear','unknown',now(),$3)",
      [rid, claims.get("regulatory"), observationId],
    );
    await app.query(
      "INSERT INTO wiki.revision_taxonomy(revision_id,taxonomy_id,claim_id,label_snapshot) VALUES($1,$2,$3,$4)",
      [rid, taxonomyId, claims.get("overview"), "Fixture Biology"],
    );
  });
  return { pid, rid, claims, slug: name.toLowerCase().replaceAll(" ", "-") };
}

test("name, DOI, evidence ceiling, and language guardrails preserve context", () => {
  assert.equal(normalizeName("BPC-157"), normalizeName("BPC157"));
  assert.equal(normalizeDoi(" https://doi.org/10.1000/ABC "), "10.1000/abc");
  assert.deepEqual(detectLanguage("This cures disease and builds muscle."), [
    "cures",
    "builds muscle",
  ]);
  assert.deepEqual(detectLanguage("A cultured cell was examined."), []);
  assert.equal(canSupportScope("human", "animal"), false);
  assert.equal(
    canSupportScope("clinical", "randomized_controlled_trial"),
    true,
  );
});
test("anonymous database reads cannot expose draft claims or preview", async () => {
  const f = await fixture("Fixture Private");
  await asActor(null, async () =>
    assert.equal(
      (
        await app.query("SELECT * FROM wiki.claim WHERE revision_id=$1", [
          f.rid,
        ])
      ).rowCount,
      0,
    ),
  );
  await assert.rejects(
    asActor(null, () =>
      app.query("SELECT wiki.article_data($1,true)", [f.rid]),
    ),
    /Preview requires/,
  );
});
test("researcher cannot approve claims or forge assessment reviewer identity", async () => {
  const f = await fixture("Fixture Researcher");
  await asActor(editor, () =>
    app.query("UPDATE wiki.claim SET approved=false WHERE id=$1", [
      f.claims.get("overview"),
    ]),
  );
  await assert.rejects(
    asActor(researcher, () =>
      app.query(
        "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE id=$2",
        [researcher.id, f.claims.get("overview")],
      ),
    ),
    /human editor/i,
  );
  await assert.rejects(
    asActor(researcher, () =>
      app.query(
        "UPDATE wiki.evidence_assessment SET reviewed_by=$1 WHERE revision_id=$2",
        [editor.id, f.rid],
      ),
    ),
    /human editor/i,
  );
});
test("wording and citation changes invalidate prior approval", async () => {
  const f = await fixture("Fixture Wording");
  const cid = f.claims.get("overview");
  await asActor(researcher, () =>
    app.query(
      "UPDATE wiki.claim SET claim_text='Synthetic changed wording for verification.' WHERE id=$1",
      [cid],
    ),
  );
  assert.equal(
    (await owner.query("SELECT approved FROM wiki.claim WHERE id=$1", [cid]))
      .rows[0].approved,
    false,
  );
  await asActor(editor, () =>
    app.query(
      "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE id=$2",
      [editor.id, cid],
    ),
  );
  await asActor(researcher, () =>
    app.query(
      "UPDATE wiki.claim_citation SET locator='Changed synthetic source locator' WHERE claim_id=$1",
      [cid],
    ),
  );
  assert.equal(
    (await owner.query("SELECT approved FROM wiki.claim WHERE id=$1", [cid]))
      .rows[0].approved,
    false,
  );
});
test("stale editor tabs cannot approve wording changed after the page was opened", async () => {
  const f = await fixture("Fixture Stale Review");
  const cid = f.claims.get("overview");
  const token = z
    .object({ token: z.string() })
    .parse(
      (
        await owner.query(
          "SELECT to_jsonb(r)->>'updated_at' AS token FROM wiki.revision r WHERE id=$1",
          [f.rid],
        )
      ).rows[0],
    ).token;
  await asActor(researcher, () =>
    app.query(
      "UPDATE wiki.claim SET claim_text='Synthetic new wording after editor opened the draft.' WHERE id=$1",
      [cid],
    ),
  );
  const { mutate } = await import("../src/lib/editorial");
  await assert.rejects(
    mutate(editor, "review", {
      id: cid,
      decision: "approve",
      reason: "Synthetic stale review verification.",
      expectedUpdatedAt: token,
    }),
    /Draft changed/,
  );
  assert.equal(
    (await owner.query("SELECT approved FROM wiki.claim WHERE id=$1", [cid]))
      .rows[0].approved,
    false,
  );
});

test("unsupported human extrapolation is rejected by database review guard", async () => {
  const f = await fixture("Fixture Scope");
  const cid = f.claims.get("overview");
  await asActor(researcher, () =>
    app.query(
      "UPDATE wiki.claim SET assertion_scope='clinical',evidence_type='animal' WHERE id=$1",
      [cid],
    ),
  );
  await assert.rejects(
    asActor(editor, () =>
      app.query(
        "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE id=$2",
        [editor.id, cid],
      ),
    ),
    /Preclinical evidence/,
  );
});
test("None Identified requires a completed search date", async () => {
  const f = await fixture("Fixture Search");
  await assert.rejects(
    asActor(editor, () =>
      app.query(
        "UPDATE wiki.evidence_assessment SET state='known',grade='None Identified' WHERE revision_id=$1 AND dimension='human'",
        [f.rid],
      ),
    ),
    /check constraint/,
  );
});
test("incomplete revision fails publication atomically", async () => {
  const f = await fixture("Fixture Incomplete");
  await asActor(editor, () =>
    app.query("UPDATE wiki.revision SET status='needs_review' WHERE id=$1", [
      f.rid,
    ]),
  );
  await asActor(editor, () =>
    app.query(
      "DELETE FROM wiki.evidence_assessment WHERE revision_id=$1 AND dimension='safety'",
      [f.rid],
    ),
  );
  await assert.rejects(
    asActor(editor, () =>
      app.query("SELECT wiki.publish_revision($1,$2)", [
        f.rid,
        "Synthetic incomplete publication test",
      ]),
    ),
    /Five reviewed/,
  );
  assert.equal(
    (
      await owner.query(
        "SELECT * FROM wiki.active_publication WHERE peptide_id=$1",
        [f.pid],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (await owner.query("SELECT status FROM wiki.revision WHERE id=$1", [f.rid]))
      .rows[0].status,
    "needs_review",
  );
});
test("claim flags block publication until an editor resolves them", async () => {
  const f = await fixture("Fixture Flags");
  const cid = f.claims.get("overview");
  await asActor(researcher, () =>
    app.query(
      "UPDATE wiki.claim SET claim_text='Synthetic fixture cures wording to exercise the guard.' WHERE id=$1",
      [cid],
    ),
  );
  await asActor(editor, async () => {
    await app.query(
      "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE id=$2",
      [editor.id, cid],
    );
    await app.query(
      "UPDATE wiki.revision SET status='needs_review' WHERE id=$1",
      [f.rid],
    );
  });
  await assert.rejects(
    asActor(editor, () =>
      app.query("SELECT wiki.publish_revision($1,$2)", [
        f.rid,
        "Synthetic flag publication test",
      ]),
    ),
    /Resolve claim flags/,
  );
});
test("citations, registry IDs, and cross-revision references enforce integrity", async () => {
  const f = await fixture("Fixture Integrity");
  const g = await fixture("Fixture Other");
  await assert.rejects(
    asActor(researcher, () =>
      app.query(
        "INSERT INTO wiki.safety_record(revision_id,claim_id,category,severity,evidence_type,known_or_theoretical) VALUES($1,$2,'toxicity','unknown','unknown','unknown')",
        [f.rid, g.claims.get("safety")],
      ),
    ),
    /foreign key/,
  );
  await assert.rejects(
    asActor(researcher, () =>
      app.query(
        "INSERT INTO wiki.clinical_trial(registry,registry_id) VALUES('ClinicalTrials.gov','BAD')",
      ),
    ),
    /check constraint/,
  );
  await assert.rejects(
    asActor(researcher, () =>
      app.query(
        "INSERT INTO wiki.claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'Missing source','supports')",
        [f.claims.get("overview"), randomUUID()],
      ),
    ),
    /foreign key/,
  );
});
test("worker identity is fixed by database login and cannot authenticate or publish", async () => {
  const workerUrl = new URL(z.string().parse(process.env.WORKER_DATABASE_URL));
  workerUrl.pathname = `/${databaseName}`;
  const worker = new pg.Client({
    connectionString: workerUrl.toString(),
    options: "-c search_path=wiki,public",
  });
  await worker.connect();
  try {
    await worker.query("SELECT set_config('wiki.actor_id',$1,false)", [
      editor.id,
    ]);
    const actual = (await worker.query("SELECT wiki.current_actor() AS id"))
      .rows[0].id;
    assert.notEqual(actual, editor.id);
    await assert.rejects(
      worker.query("SELECT wiki.require_editor()"),
      /human editor/i,
    );
    await assert.rejects(
      worker.query("SELECT * FROM wiki.auth_credentials($1)", [editor.email]),
      /permission denied/,
    );
  } finally {
    await worker.end();
  }
});
test("publication waits for concurrent review changes and rejects a revoked claim", async () => {
  const f = await fixture("Fixture Concurrent");
  await asActor(editor, () =>
    app.query("UPDATE wiki.revision SET status='needs_review' WHERE id=$1", [
      f.rid,
    ]),
  );
  const blocker = new pg.Client({
    connectionString: serverUrl.toString(),
    options: "-c search_path=wiki,public",
  });
  await blocker.connect();
  const publisher = new pg.Client({
    connectionString: serverUrl.toString(),
    options: "-c search_path=wiki,public",
  });
  await publisher.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT set_config('wiki.actor_id',$1,true)", [
      editor.id,
    ]);
    await blocker.query("SELECT id FROM wiki.revision WHERE id=$1 FOR UPDATE", [
      f.rid,
    ]);
    await publisher.query("BEGIN");
    await publisher.query("SELECT set_config('wiki.actor_id',$1,true)", [
      editor.id,
    ]);
    const waiting = publisher
      .query("SELECT wiki.publish_revision($1,$2)", [
        f.rid,
        "Concurrent synthetic publication verification",
      ])
      .then(
        () => ({ kind: "published" }),
        (error) => ({ kind: "rejected", message: String(error) }),
      );
    await blocker.query("UPDATE wiki.claim SET approved=false WHERE id=$1", [
      f.claims.get("overview"),
    ]);
    await blocker.query("COMMIT");
    const result = await waiting;
    assert.equal(result.kind, "rejected");
    if ("message" in result) assert.match(result.message, /human approval/);
    await publisher.query("ROLLBACK");
    assert.equal(
      (
        await owner.query(
          "SELECT 1 FROM wiki.active_publication WHERE peptide_id=$1",
          [f.pid],
        )
      ).rowCount,
      0,
    );
  } finally {
    await blocker.query("ROLLBACK");
    await blocker.end();
    await publisher.end();
  }
});

let alpha: Awaited<ReturnType<typeof fixture>>;
let beta: Awaited<ReturnType<typeof fixture>>;
let draft: Awaited<ReturnType<typeof fixture>>;
test("publish is idempotent and freezes content, citations, and extension inserts", async () => {
  alpha = await fixture("Fixture Alpha");
  beta = await fixture("Fixture Beta");
  draft = await fixture("Fixture Editorial");
  for (const f of [alpha, beta]) {
    await asActor(editor, () =>
      app.query("UPDATE wiki.revision SET status='needs_review' WHERE id=$1", [
        f.rid,
      ]),
    );
    const first = await asActor(editor, () =>
      app.query("SELECT wiki.publish_revision($1,$2) AS id", [
        f.rid,
        "Synthetic isolated fixture publication",
      ]),
    );
    const again = await asActor(editor, () =>
      app.query("SELECT wiki.publish_revision($1,$2) AS id", [
        f.rid,
        "Idempotent synthetic repeat",
      ]),
    );
    assert.equal(first.rows[0].id, again.rows[0].id);
  }
  await assert.rejects(
    asActor(editor, () =>
      app.query(
        "UPDATE wiki.claim SET claim_text='Forbidden mutation of published synthetic content.' WHERE revision_id=$1",
        [alpha.rid],
      ),
    ),
    /frozen/,
  );
  await assert.rejects(
    asActor(editor, () =>
      app.query(
        "INSERT INTO wiki.claim(revision_id,section,claim_text,assertion_scope,origin) VALUES($1,'overview','Forbidden child insertion.','unknown','ai')",
        [alpha.rid],
      ),
    ),
    /frozen/,
  );
  await assert.rejects(
    asActor(editor, () =>
      app.query("DELETE FROM wiki.claim_citation WHERE claim_id=$1", [
        alpha.claims.get("overview"),
      ]),
    ),
    /frozen/,
  );
  await assert.rejects(
    asActor(editor, () =>
      app.query(
        "INSERT INTO wiki.safety_record(revision_id,claim_id,category,severity,evidence_type,known_or_theoretical) VALUES($1,$2,'toxicity','unknown','unknown','unknown')",
        [alpha.rid, alpha.claims.get("safety")],
      ),
    ),
    /frozen/,
  );
});
test("published catalog supports aliases, typo search, filtering, and withdrawal", async () => {
  const { searchCatalog, readArticle } = await import("../src/lib/catalog");
  assert.equal(
    (await searchCatalog({ query: "FixtureAlpha" }))[0]?.slug,
    alpha.slug,
  );
  assert.ok(
    (await searchCatalog({ query: "Fixtur Alfa" })).some(
      (x) => x.slug === alpha.slug,
    ),
  );
  assert.equal((await searchCatalog({ area: "fixture-biology" })).length, 2);
  const article = await readArticle(alpha.slug);
  assert.ok(article);
  assert.equal(article.status, "published");
  assert.ok(article.claims.every((c) => c.approved && c.citations.length > 0));
  const withdrawn = await fixture("Fixture Withdrawn");
  await asActor(editor, async () => {
    await app.query(
      "UPDATE wiki.revision SET status='needs_review' WHERE id=$1",
      [withdrawn.rid],
    );
    await app.query("SELECT wiki.publish_revision($1,$2)", [
      withdrawn.rid,
      "Synthetic fixture for withdrawal",
    ]);
    await app.query("SELECT wiki.withdraw_publication($1,$2)", [
      withdrawn.pid,
      "Withdraw synthetic test page",
    ]);
  });
  assert.equal(await readArticle(withdrawn.slug), null);
});
test("AI extraction writes an interpretation and unreviewed claims only", async () => {
  const { extractDraft } = await import("../src/lib/research");
  const f = await fixture("Fixture Extraction");
  await extractDraft(
    { revisionId: f.rid, observationId, actorId: researcher.id },
    {
      async extract() {
        return {
          claims: [
            {
              text: "Synthetic extracted text for software testing only.",
              plainText: "Synthetic plain interpretation only.",
              evidenceType: "unknown",
              scope: "unknown",
              locator: "Synthetic source passage",
              limitations: "This is a synthetic isolated software test.",
              species: null,
              sampleSize: null,
            },
          ],
          uncertainties: ["Synthetic unknown"],
        };
      },
    },
  );
  const result = await owner.query(
    "SELECT approved,origin,extraction_id FROM wiki.claim WHERE revision_id=$1 AND origin='ai'",
    [f.rid],
  );
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].approved, false);
  assert.ok(result.rows[0].extraction_id);
  await assert.rejects(
    extractDraft(
      { revisionId: alpha.rid, observationId, actorId: researcher.id },
      {
        async extract() {
          return {
            claims: [
              {
                text: "Cannot add to a published fixture.",
                plainText: "Synthetic only.",
                evidenceType: "unknown",
                scope: "unknown",
                locator: "Synthetic",
                limitations: "Synthetic verification only.",
                species: null,
                sampleSize: null,
              },
            ],
            uncertainties: [],
          };
        },
      },
    ),
    /frozen/,
  );
});

test(
  "real browser: search, citations, areas, comparison, themes, mobile, authentication and review",
  { timeout: 120000 },
  async () => {
    child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3049",
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: serverUrl.toString(),
          SITE_URL: base,
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${base}/women`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(ready, output);
    browser = await chromium.launch({
      headless: true,
      executablePath: chromium.executablePath(),
    });
    const trialClaim = randomUUID();
    await owner.query(
      "INSERT INTO wiki.claim(id,revision_id,section,claim_text,assertion_scope,evidence_type,limitations,origin) VALUES($1,$2,'trials','Fixture Editorial: synthetic registry entry for software verification only.','regulatory','regulatory','Synthetic isolated fixture, no scientific interpretation.','human')",
      [trialClaim, draft.rid],
    );
    await owner.query(
      "INSERT INTO wiki.claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,'Synthetic fixture passage','supports')",
      [trialClaim, observationId],
    );
    await asActor(editor, () =>
      app.query(
        "UPDATE wiki.claim SET approved=true,reviewed_by=$1 WHERE id=$2",
        [editor.id, trialClaim],
      ),
    );
    const trialId = randomUUID();
    await owner.query(
      "INSERT INTO wiki.clinical_trial(id,registry,registry_id) VALUES($1,'ClinicalTrials.gov','NCT00000000')",
      [trialId],
    );
    await owner.query(
      "INSERT INTO wiki.trial_record(revision_id,trial_id,claim_id,observation_id,title,status,results_available,source_url) VALUES($1,$2,$3,$4,'Synthetic registry entry','COMPLETED',false,'https://clinicaltrials.gov/study/NCT00000000')",
      [draft.rid, trialId, trialClaim, observationId],
    );
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const policyViolations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text()))
        policyViolations.push(message.text());
    });
    page.on("pageerror", (error) => policyViolations.push(error.message));
    // Hydration is proven by the analytics beacon, which only a running script can send.
    const beacon = page.waitForRequest((r) => r.url().endsWith("/api/events"));
    const home = await page.goto(`${base}/women`);
    const policy = home?.headers()["content-security-policy"] ?? "";
    const scriptPolicy = policy.match(/script-src[^;]*/)?.[0] ?? "";
    assert.match(scriptPolicy, /'nonce-[^']+' 'strict-dynamic'/);
    assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);
    assert.match(policy, /object-src 'none'/);
    await beacon;
    await page.getByRole("searchbox").fill("FixtureAlpha");
    await page.getByRole("button", { name: /^Search/ }).click();
    await page
      .getByRole("link", { name: /Human evidence: Unknown Fixture Alpha/ })
      .click();
    await page
      .getByRole("heading", { name: "Fixture Alpha", exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: /Reference 1:/ })
      .first()
      .click();
    assert.ok(page.url().endsWith("#ref-1"));
    await page
      .getByRole("heading", { name: "References", exact: true })
      .waitFor();
    const scientificWomen = await page.locator(".article-body").innerText();
    await page.goto(`${base}/50plus/peptides/${alpha.slug}`);
    assert.equal(
      await page.locator(".article-body").innerText(),
      scientificWomen,
    );
    await page.goto(`${base}/women/browse?area=fixture-biology`);
    assert.equal(await page.locator(".peptide-card").count(), 2);
    await page.goto(`${base}/women/compare`);
    await page.getByLabel("Fixture Alpha", { exact: true }).check();
    await page.getByLabel("Fixture Beta", { exact: true }).check();
    await page
      .getByRole("button", { name: "Compare selected profiles" })
      .click();
    await page.getByRole("table").waitFor();
    await mkdir("research/screenshots", { recursive: true });
    await page.goto(`${base}/women`);
    await page.screenshot({
      path: "research/screenshots/home-desktop.png",
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
      ),
      [],
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "research/screenshots/home-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.goto(`${base}/50plus`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    const comfortAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      comfortAxe.violations.map((v) => v.id),
      [],
    );
    await page.goto(`${base}/admin`);
    assert.ok(page.url().includes("/login"));
    await page.getByLabel("Email", { exact: true }).fill(editor.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("heading", { name: "A careful path to publication." })
      .waitFor();
    await page.goto(`${base}/admin/revisions/${draft.rid}`);
    await page
      .getByRole("heading", { name: "Fixture Editorial", exact: true })
      .first()
      .waitFor();
    const adminAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      adminAxe.violations.map((v) => v.id),
      [],
    );
    await page.getByRole("button", { name: "Submit for human review" }).click();
    await page.goto(`${base}/admin/revisions/${draft.rid}`);
    await page
      .getByLabel("Publication reason", { exact: true })
      .fill("Synthetic isolated browser publication verification.");
    await page
      .getByRole("button", { name: "Publish reviewed revision" })
      .click();
    await page.goto(`${base}/women/peptides/${draft.slug}`);
    await page
      .getByRole("heading", { name: "Fixture Editorial", exact: true })
      .waitFor();
    const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
    assert.ok(sitemap.includes(alpha.slug));
    assert.ok(!sitemap.includes("fixture-private"));
    const csrf = await page.request.post(`${base}/api/editorial`, {
      headers: { Origin: "https://foreign.invalid" },
      form: {
        operation: "withdraw",
        id: alpha.pid,
        reason: "Cross-origin request must fail",
      },
    });
    assert.ok(csrf.url().includes("error="));
    assert.ok(
      await fetch(`${base}/women/peptides/${alpha.slug}`).then((r) => r.ok),
    );
    await page.goto(`${base}/women/peptides/${draft.slug}`);
    await page.getByTestId("registry-notice").waitFor();
    assert.match(
      await page.locator(".trial-card").innerText(),
      /Registry snapshot retrieved \d{4}-\d{2}-\d{2}/,
    );
    // A missing page is rendered per request too, so it carries a nonce and runs without violations.
    const missing = await page.goto(`${base}/women/peptides/no-such-peptide`);
    assert.equal(missing?.status(), 404);
    assert.match(
      missing?.headers()["content-security-policy"] ?? "",
      /'nonce-[^']+'/,
    );
    assert.deepEqual(policyViolations, []);
    await context.close();
  },
);
