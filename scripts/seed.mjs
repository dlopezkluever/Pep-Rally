import pg from "pg";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
const c = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  options: "-c search_path=wiki,public",
});
await c.connect();
const names = [
  ["Semaglutide", "semaglutide", ["Wegovy", "Ozempic"]],
  ["CJC-1295", "cjc-1295", ["CJC1295"]],
  ["BPC-157", "bpc-157", ["BPC157", "Body Protection Compound 157"]],
  ["Kisspeptin-54", "kisspeptin-54", ["KP-54", "Metastin"]],
  ["MOTS-c", "mots-c", ["MOTSC"]],
  ["GHK-Cu", "ghk-cu", ["Copper tripeptide-1"]],
  ["Ipamorelin", "ipamorelin", []],
  ["Elamipretide", "elamipretide", ["SS-31", "Forzinity"]],
  ["Semax", "semax", []],
  ["Selank", "selank", []],
  ["Thymosin alpha-1", "thymosin-alpha-1", ["Thymalfasin"]],
  ["Thymosin beta-4", "thymosin-beta-4", []],
  ["Bremelanotide", "bremelanotide", ["PT-141"]],
  ["Tesamorelin", "tesamorelin", []],
  ["Sermorelin", "sermorelin", []],
  ["Oxytocin", "oxytocin", []],
  ["Liraglutide", "liraglutide", []],
  ["Tirzepatide", "tirzepatide", []],
  ["Exenatide", "exenatide", []],
  ["Glucagon", "glucagon", []],
  ["Gonadorelin", "gonadorelin", []],
  ["Teriparatide", "teriparatide", []],
];
const sourceMap = {
  semaglutide: [
    "fda-wegovy-label-2026-03",
    "pmid-33567185",
    "ctgov-NCT03548935",
  ],
  "cjc-1295": [
    "pmid-15817669",
    "pmid-16352683",
    "ctgov-NCT00267527",
    "fda-compounding-safety-live",
  ],
  "bpc-157": [
    "pmid-14554208",
    "pmid-21030672",
    "pmid-40131143",
    "fda-compounding-safety-live",
  ],
  "kisspeptin-54": [
    "iuphar-kisspeptin-receptor-266",
    "pmid-25036713",
    "pmid-28854728",
    "ctgov-NCT01667406",
  ],
  "mots-c": [
    "pmid-25738459",
    "pmid-33473109",
    "ctgov-NCT07505745",
    "fda-compounding-safety-live",
  ],
};
const areaNames = [
  "Metabolism",
  "Mitochondrial Biology",
  "Skin Biology",
  "Neuroscience",
  "Sleep",
  "Tissue Repair",
  "Immune Biology",
  "Muscle Biology",
  "Healthy Aging",
  "Growth Hormone Axis",
  "Reproductive Biology",
  "Cardiovascular Biology",
];
const familyNames = [
  "GLP-1 / Incretin",
  "GHRH",
  "GHRP",
  "Thymosin",
  "Copper Peptides",
  "Melanocortin",
  "Mitochondrial Peptides",
  "Neuropeptides",
];
const slugify = (x) =>
  x
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const manifest = JSON.parse(
  await readFile("research/validation-sources.json", "utf8"),
);
try {
  await c.query("BEGIN");
  if (
    !process.env.EDITOR_EMAIL ||
    !process.env.EDITOR_PASSWORD ||
    process.env.EDITOR_PASSWORD.length < 16
  )
    throw new Error(
      "Configure a unique EDITOR_PASSWORD of at least 16 characters",
    );
  const salt = randomBytes(16).toString("hex");
  await c.query(
    "INSERT INTO actor(email,display_name,password_hash,role) VALUES($1,'Local human editor',$2,'editor') ON CONFLICT(email) DO NOTHING",
    [
      process.env.EDITOR_EMAIL.toLowerCase(),
      `${salt}:${scryptSync(process.env.EDITOR_PASSWORD, salt, 64).toString("hex")}`,
    ],
  );
  for (const [kind, labels] of [
    ["area", areaNames],
    ["family", familyNames],
  ])
    for (const label of labels)
      await c.query(
        "INSERT INTO taxonomy(kind,slug,label) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [kind, slugify(label), label],
      );
  const observations = new Map();
  for (const s of manifest.sources) {
    const r = await c.query(
      "INSERT INTO source(identity_key,source_type) VALUES($1,$2) ON CONFLICT(identity_key) DO NOTHING RETURNING id",
      [s.id, s.source_type],
    );
    const sid =
      r.rows[0]?.id ??
      (await c.query("SELECT id FROM source WHERE identity_key=$1", [s.id]))
        .rows[0].id;
    const hash = createHash("sha256").update(JSON.stringify(s)).digest("hex");
    const scope =
      s.source_type === "trial_registry"
        ? "registry"
        : s.source_type.startsWith("regulatory") ||
            s.publisher === "US Food and Drug Administration"
          ? "regulatory"
          : s.access_scope.toLowerCase().includes("full") &&
              !s.access_scope.toLowerCase().includes("not")
            ? "full_text"
            : s.access_scope.toLowerCase().includes("abstract")
              ? "abstract"
              : "metadata";
    const rawDate = s.publication_date;
    const date = rawDate
      ? /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : null
      : null;
    await c.query(
      "INSERT INTO source_observation(source_id,title,authors,publication,publication_date,url,content_hash,text_scope,license_note,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
      [
        sid,
        s.title,
        s.authors ?? [],
        s.publication ?? s.publisher ?? null,
        date,
        s.url,
        hash,
        scope,
        "Bibliographic metadata and original AI research notes only. Original text not redistributed. Verify source-specific rights before importing excerpts.",
        JSON.stringify({
          access_scope: s.access_scope,
          molecule_scope: s.molecule_scope,
          limitations: s.limitations,
        }),
      ],
    );
    const oid = (
      await c.query(
        "SELECT id FROM source_observation WHERE source_id=$1 AND content_hash=$2",
        [sid, hash],
      )
    ).rows[0].id;
    observations.set(s.id, oid);
    for (const [namespace, value] of Object.entries(s.identifiers ?? {}))
      if (["pmid", "doi", "nct_id"].includes(namespace))
        await c.query(
          "INSERT INTO source_identifier(source_id,namespace,value) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [sid, namespace, String(value).toLowerCase()],
        );
  }
  let seeded = 0;
  for (const [name, slug, aliases] of names) {
    await c.query(
      "INSERT INTO peptide(canonical_name,slug) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [name, slug],
    );
    const pid = (await c.query("SELECT id FROM peptide WHERE slug=$1", [slug]))
      .rows[0].id;
    for (const alias of aliases)
      await c.query(
        "INSERT INTO peptide_alias(peptide_id,alias,alias_type) VALUES($1,$2,'scientific') ON CONFLICT DO NOTHING",
        [pid, alias],
      );
    if (
      (await c.query("SELECT 1 FROM revision WHERE peptide_id=$1", [pid]))
        .rowCount
    )
      continue;
    const rev = (
      await c.query(
        "INSERT INTO revision(peptide_id,status,last_researched_at) VALUES($1,$2,$3) RETURNING id",
        [
          pid,
          sourceMap[slug] ? "draft" : "unresearched",
          sourceMap[slug] ? manifest.retrieved_on : null,
        ],
      )
    ).rows[0].id;
    await c.query("INSERT INTO peptide_profile(revision_id) VALUES($1)", [rev]);
    for (const dimension of [
      "preclinical",
      "human",
      "clinical",
      "safety",
      "regulatory",
    ])
      await c.query(
        "INSERT INTO evidence_assessment(revision_id,dimension,state,rationale,search_scope) VALUES($1,$2,'unknown','Unreviewed research. A human editor must assess this dimension.','Bounded validation source sample; not a completed systematic search')",
        [rev, dimension],
      );
    let order = 0;
    for (const key of sourceMap[slug] ?? []) {
      const s = manifest.sources.find((x) => x.id === key);
      const oid = observations.get(key);
      const types = Array.isArray(s.evidence_type)
        ? s.evidence_type
        : [s.evidence_type ?? "unknown"];
      const type = types[0];
      const scope =
        type === "animal"
          ? "animal"
          : type === "in_vitro"
            ? "cell"
            : s.source_type === "trial_registry"
              ? "unknown"
              : s.source_type.includes("regulatory") || key.startsWith("fda-")
                ? "regulatory"
                : type === "unknown"
                  ? "unknown"
                  : "human";
      const section =
        order === 0
          ? "overview"
          : scope === "regulatory"
            ? "regulatory"
            : s.source_type === "trial_registry"
              ? "trials"
              : scope === "animal"
                ? "animal"
                : scope === "cell"
                  ? "cell"
                  : scope === "human"
                    ? "human"
                    : "mechanism";
      const limitations = (s.limitations ?? []).join(" ");
      const claim = (
        await c.query(
          "INSERT INTO claim(revision_id,section,claim_text,assertion_scope,evidence_type,limitations,origin,sort_order) VALUES($1,$2,$3,$4,$5,$6,'ai',$7) RETURNING id",
          [
            rev,
            section,
            s.supported_facts.join(" "),
            scope,
            type,
            limitations || "Full source appraisal pending.",
            order++,
          ],
        )
      ).rows[0].id;
      await c.query(
        "INSERT INTO claim_citation(claim_id,observation_id,locator,relation) VALUES($1,$2,$3,'supports')",
        [
          claim,
          oid,
          `${s.access_scope}. Verify the specific underlying passage before approval.`,
        ],
      );
      if (
        [
          "animal",
          "in_vitro",
          "observational",
          "pilot_human",
          "clinical_trial",
          "randomized_controlled_trial",
        ].includes(type)
      ) {
        const studyKey = s.identifiers?.trial_id ?? s.id;
        await c.query(
          "INSERT INTO study(identity_key,species) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [studyKey, s.species ?? null],
        );
        const study = (
          await c.query("SELECT id FROM study WHERE identity_key=$1", [
            studyKey,
          ])
        ).rows[0].id;
        await c.query(
          "INSERT INTO evidence_record(revision_id,study_id,observation_id,claim_id,evidence_type,title,summary,finding,confidence,limitations) VALUES($1,$2,$3,$4,$5,$6,$7,$7,'unassessed',$8)",
          [
            rev,
            study,
            oid,
            claim,
            type,
            s.title,
            s.supported_facts.join(" "),
            limitations || "Full appraisal pending",
          ],
        );
      }
    }
    if (sourceMap[slug]) seeded++;
  }
  await c.query("COMMIT");
  process.stdout.write(
    `Seed complete: ${names.length} identities, ${seeded} new research drafts. No approvals or publications created.\n`,
  );
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
await import("./normalize-mixed-evidence.mjs");
