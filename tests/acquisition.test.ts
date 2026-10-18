import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  buildLiteratureQueryPlan,
  searchSubjects,
} from "../src/lib/query-plan";
import type { AdapterContext, Fetcher } from "../src/lib/source-http";
import { createDisposableDatabase } from "./harness";

let db: Awaited<ReturnType<typeof createDisposableDatabase>>;
let research: typeof import("../src/lib/research");
let adapters: typeof import("../src/lib/adapters");
let database: typeof import("../src/lib/db");
let SourceHttpError: typeof import("../src/lib/source-http").SourceHttpError;

before(
  async () => {
    db = await createDisposableDatabase();
    // Anything that imports the database module creates its pool from this
    // variable, so every such import must happen after this line.
    process.env.DATABASE_URL = db.workerUrl.toString();
    database = await import("../src/lib/db");
    research = await import("../src/lib/research");
    adapters = await import("../src/lib/adapters");
    ({ SourceHttpError } = await import("../src/lib/source-http"));
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
  },
  { timeout: 60000 },
);
after(async () => {
  await database?.closeDatabase();
  await db?.drop();
});

/** Fake transport that records every request, so paging and headers can be asserted. */
function transport(
  handler: (
    url: URL,
    options: RequestInit | undefined,
  ) => unknown | { body: unknown; headers: Record<string, string> },
) {
  const calls: { url: URL; options?: RequestInit }[] = [];
  const fetch: Fetcher = async (url, options) => {
    calls.push({ url, options });
    const out = handler(url, options) as {
      body?: unknown;
      headers?: Record<string, string>;
    } | null;
    const wrapped = out && "headers" in out && "body" in out;
    return {
      body: wrapped ? out.body : out,
      headers: new Headers(wrapped ? out.headers : {}),
    };
  };
  return { fetch, calls };
}
const context = (
  fetch: Fetcher,
  extra: Partial<AdapterContext> = {},
): AdapterContext => ({
  name: "Fixture Alpha",
  aliases: [],
  seeds: {},
  fetch,
  ...extra,
});

test("query plan applies the PRD query set and bounds alias expansion", () => {
  const plan = buildLiteratureQueryPlan("Fixture Alpha", []);
  assert.deepEqual(
    plan.map((q) => q.text),
    [
      '"Fixture Alpha"',
      '"Fixture Alpha" human',
      '"Fixture Alpha" clinical trial',
      '"Fixture Alpha" randomized',
      '"Fixture Alpha" pharmacokinetics',
      '"Fixture Alpha" mechanism',
      '"Fixture Alpha" safety',
      '"Fixture Alpha" toxicity',
      '"Fixture Alpha" animal',
      '"Fixture Alpha" review',
    ],
  );
  // BPC157 and BPC-157 normalize to one name, so they cost one search.
  assert.deepEqual(
    searchSubjects("BPC-157", [
      "BPC157",
      "Body Protection Compound",
      "bpc 157",
    ]),
    ["BPC-157", "Body Protection Compound"],
  );
  const many = searchSubjects(
    "Fixture Alpha",
    Array.from({ length: 12 }, (_, i) => `Alias ${i}x`),
  );
  assert.equal(many.length, 5);
  const withAlias = buildLiteratureQueryPlan("Fixture Alpha", ["Alpha Code"]);
  assert.deepEqual(
    withAlias.slice(10).map((q) => q.text),
    ['"Alpha Code"', '"Alpha Code" human'],
  );
  // A quote in a name cannot break out of the phrase.
  assert.equal(buildLiteratureQueryPlan('Odd "Name', [])[0].text, '"Odd Name"');
});

function pubmedFixture(totals: Record<string, number>) {
  const papers = (n: number) =>
    Array.from({ length: n }, (_, i) => String(1000 + i));
  return transport((url) => {
    if (url.pathname.endsWith("esearch.fcgi")) {
      const term = url.searchParams.get("term") ?? "";
      const total = totals[term] ?? 0;
      const start = Number(url.searchParams.get("retstart"));
      const size = Number(url.searchParams.get("retmax"));
      return {
        esearchresult: {
          count: String(total),
          retmax: String(size),
          retstart: String(start),
          idlist: papers(total).slice(start, start + size),
          querytranslation: `${term}[All Fields]`,
        },
      };
    }
    const ids = (url.searchParams.get("id") ?? "").split(",");
    return {
      result: {
        uids: ids,
        ...Object.fromEntries(
          ids.map((id) => [
            id,
            {
              uid: id,
              title: `Synthetic paper ${id}`,
              pubdate: "2020 Jan",
              fulljournalname: "Synthetic Journal",
              pubtype: ["Journal Article"],
              articleids: [
                { idtype: "pubmed", value: id },
                { idtype: "doi", value: `10.1000/SYNTH.${id}` },
              ],
            },
          ]),
        ),
      },
    };
  });
}

test("PubMed adapter pages to each query's limit and reports truncation", async () => {
  const t = pubmedFixture({
    '"Fixture Alpha"': 47,
    '"Fixture Alpha" human': 300,
  });
  const run = await adapters.discoverPubMed(context(t.fetch));
  const name = run.searches.find((s) => s.query === '"Fixture Alpha"');
  assert.deepEqual(
    [name?.total, name?.retrieved, name?.pages, name?.truncated],
    [47, 47, 3, false],
  );
  const pagedStarts = t.calls
    .filter((c) => c.url.searchParams.get("term") === '"Fixture Alpha"')
    .map((c) => c.url.searchParams.get("retstart"));
  assert.deepEqual(pagedStarts, ["0", "20", "40"]);
  const human = run.searches.find((s) => s.query.endsWith("human"));
  assert.deepEqual(
    [human?.total, human?.retrieved, human?.truncated],
    [300, 20, true],
  );
  const empty = run.searches.find((s) => s.query.endsWith("review"));
  assert.deepEqual([empty?.total, empty?.retrieved, empty?.pages], [0, 0, 1]);
  assert.equal(run.searches.length, 10);
  assert.equal(name?.translation, '"Fixture Alpha"[All Fields]');
  // One paper matched by two queries is one source with both queries recorded.
  assert.equal(run.found.length, 47);
  const first = run.found.find((f) => f.source.identity === "pmid-1000");
  assert.deepEqual(first?.queries, [
    '"Fixture Alpha"',
    '"Fixture Alpha" human',
  ]);
  assert.deepEqual(first?.source.identifiers, {
    pmid: "1000",
    doi: "10.1000/synth.1000",
  });
  const note = z
    .object({ publicationTypes: z.array(z.string()), screening: z.string() })
    .parse(JSON.parse(first!.source.notes));
  assert.deepEqual(note.publicationTypes, ["Journal Article"]);
  assert.match(note.screening, /Unscreened/);
  // The notes carry no query, so the same paper hashes identically under any query.
  assert.doesNotMatch(first!.source.notes, /Fixture Alpha/);
});

test("PubMed requests never persist credentials in search records", async () => {
  process.env.NCBI_API_KEY = "synthetic-secret-key";
  process.env.NCBI_EMAIL = "operator@example.invalid";
  try {
    const t = pubmedFixture({});
    const run = await adapters.discoverPubMed(context(t.fetch));
    assert.ok(
      t.calls.every(
        (c) => c.url.searchParams.get("api_key") === "synthetic-secret-key",
      ),
    );
    for (const s of run.searches) {
      assert.doesNotMatch(s.url, /synthetic-secret-key|operator@example/);
    }
  } finally {
    delete process.env.NCBI_API_KEY;
    delete process.env.NCBI_EMAIL;
  }
});

const study = (i: number) => ({
  protocolSection: {
    identificationModule: {
      nctId: `NCT${String(10000000 + i)}`,
      briefTitle: `Synthetic trial ${i}`,
    },
    statusModule: { overallStatus: "COMPLETED" },
  },
  hasResults: false,
});
test("ClinicalTrials adapter follows page tokens up to the limit", async () => {
  const t = transport((url) => {
    const token = url.searchParams.get("pageToken");
    const page = token === "T1" ? 1 : 0;
    return {
      totalCount: 80,
      nextPageToken: `T${page + 1}`,
      studies: Array.from({ length: 25 }, (_, i) => study(page * 25 + i)),
    };
  });
  const run = await adapters.discoverTrials(context(t.fetch));
  assert.equal(t.calls.length, 2);
  assert.equal(t.calls[0].url.searchParams.get("pageToken"), null);
  assert.equal(t.calls[1].url.searchParams.get("pageToken"), "T1");
  assert.equal(t.calls[0].url.searchParams.get("query.intr"), "Fixture Alpha");
  assert.deepEqual(
    [
      run.searches[0].total,
      run.searches[0].retrieved,
      run.searches[0].truncated,
    ],
    [80, 50, true],
  );
  assert.equal(run.found.length, 50);
  assert.deepEqual(run.found[0].source.identifiers, { nct_id: "NCT10000000" });
});

test("services that answer 404 or 204 for no matches yield empty results, not failures", async () => {
  const notFound = transport(() => {
    throw new SourceHttpError(404, "pubchem.ncbi.nlm.nih.gov");
  });
  assert.deepEqual(
    (await adapters.discoverChemistry(context(notFound.fetch))).found,
    [],
  );
  assert.deepEqual(
    (await adapters.discoverRegulatory(context(notFound.fetch))).found,
    [],
  );
  const noBody = transport(() => null);
  const structures = await adapters.discoverStructures(context(noBody.fetch));
  assert.deepEqual(structures.found, []);
  assert.equal(structures.searches[0].total, 0);
  // Server errors are real failures and must not be swallowed.
  const outage = transport(() => {
    throw new SourceHttpError(503, "api.fda.gov");
  });
  await assert.rejects(
    adapters.discoverRegulatory(context(outage.fetch)),
    /503/,
  );
});

test("PubChem and FDA candidates carry screening caveats and seed provenance", async () => {
  const chem = transport(() => ({
    PropertyTable: {
      Properties: [
        {
          CID: 4242,
          MolecularFormula: "C1H1",
          MolecularWeight: "12.01",
          InChIKey: "SYNTHETICKEY-UHFFFAOYSA-N",
        },
      ],
    },
  }));
  const run = await adapters.discoverChemistry(
    context(chem.fetch, { seeds: { pubchem: "4242" } }),
  );
  assert.equal(run.found.length, 1);
  assert.deepEqual(run.found[0].queries, [
    "name: Fixture Alpha",
    "seed identifier: pubchem CID 4242",
  ]);
  assert.match(run.found[0].source.notes, /human identity review/);
  const fda = transport(() => ({
    meta: { results: { total: 9 } },
    results: [{ application_number: "NDA123456", sponsor_name: "Synthetic" }],
  }));
  const reg = await adapters.discoverRegulatory(context(fda.fetch));
  assert.equal(reg.searches[0].total, 9);
  assert.equal(reg.searches[0].truncated, true);
  assert.match(
    reg.found[0].source.notes,
    /never shows a compound is unapproved/,
  );
});

test("RCSB adapter batches entry details and tolerates unknown entries", async () => {
  const t = transport((url) => {
    if (url.hostname === "search.rcsb.org") {
      const body = JSON.parse(String(t.calls.at(-1)?.options?.body));
      assert.equal(
        body.request_options.results_content_type[0],
        "experimental",
      );
      return {
        total_count: 36,
        result_set: [
          { identifier: "1XY1" },
          { identifier: "2MGO" },
          { identifier: "9ZZZ" },
        ],
      };
    }
    return {
      data: {
        entries: [
          {
            rcsb_id: "1XY1",
            struct: { title: "SYNTHETIC STRUCTURE ONE" },
            exptl: [{ method: "X-RAY DIFFRACTION" }],
            rcsb_accession_info: {
              initial_release_date: "1988-04-16T00:00:00Z",
            },
            rcsb_primary_citation: {
              pdbx_database_id_PubMed: 3008332,
              pdbx_database_id_DOI: null,
            },
          },
          {
            rcsb_id: "2MGO",
            struct: null,
            exptl: null,
            rcsb_accession_info: null,
            rcsb_primary_citation: null,
          },
          null,
        ],
      },
    };
  });
  const run = await adapters.discoverStructures(context(t.fetch));
  assert.equal(
    t.calls.filter((c) => c.url.hostname === "data.rcsb.org").length,
    1,
  );
  assert.deepEqual(
    run.found.map((f) => f.source.identity),
    ["pdb-1XY1", "pdb-2MGO"],
  );
  assert.deepEqual(run.found[0].source.identifiers, { pdb_id: "1XY1" });
  assert.match(
    run.found[0].source.notes,
    /never identity, human mechanism, safety, or efficacy/,
  );
  assert.equal(run.searches[0].truncated, true);
});

test("UniProt adapter records release provenance and warns about precursor sequences", async () => {
  const entry = (accession: string) => ({
    entryType: "UniProtKB reviewed (Swiss-Prot)",
    primaryAccession: accession,
    uniProtkbId: "SYNTH_HUMAN",
    organism: { scientificName: "Homo sapiens" },
    proteinDescription: {
      recommendedName: { fullName: { value: "Synthetic proprotein" } },
    },
    sequence: { length: 125 },
  });
  const t = transport((url) => ({
    body: url.pathname.endsWith("/search")
      ? { results: [entry("P00001")] }
      : entry("P00002"),
    headers: { "x-total-results": "194", "x-uniprot-release": "2026_03" },
  }));
  const run = await adapters.discoverProteins(
    context(t.fetch, { seeds: { uniprot: "P00002" } }),
  );
  assert.deepEqual(
    run.found.map((f) => f.source.identifiers.uniprot),
    ["P00001", "P00002"],
  );
  assert.deepEqual(
    [run.searches[0].total, run.searches[0].release, run.searches[0].truncated],
    [194, "2026_03", true],
  );
  assert.match(
    run.found[0].source.notes,
    /precursor protein is not the mature peptide/,
  );
  assert.equal(
    t.calls[0].url.searchParams.get("query"),
    '("Fixture Alpha") AND (reviewed:true)',
  );
  // The release is a search record, not source content, so a monthly release does not mark entries changed.
  assert.doesNotMatch(run.found[0].source.notes, /2026_03/);
});

test("IUPHAR adapter is skipped without a key and sends the key header when configured", async () => {
  delete process.env.IUPHAR_API_KEY;
  const none = transport(() => {
    throw new Error("must not call the service without a key");
  });
  const skipped = await adapters.discoverPharmacology(context(none.fetch));
  assert.match(skipped.skipped ?? "", /IUPHAR_API_KEY/);
  assert.equal(none.calls.length, 0);
  process.env.IUPHAR_API_KEY = "synthetic-iuphar-key";
  try {
    const t = transport((url) =>
      url.pathname.endsWith("/ligands")
        ? [{ ligandId: 7, name: "Synthetic ligand", approved: true }]
        : { ligandId: 8, name: "Seeded ligand" },
    );
    const run = await adapters.discoverPharmacology(
      context(t.fetch, { seeds: { iuphar: "8" } }),
    );
    assert.equal(
      (t.calls[0].options?.headers as Record<string, string>)["GTP-API-Key"],
      "synthetic-iuphar-key",
    );
    assert.deepEqual(
      run.found.map((f) => f.source.identity),
      ["iuphar-ligand-7", "iuphar-ligand-8"],
    );
    assert.match(run.found[0].source.notes, /not FDA status/);
    for (const s of run.searches)
      assert.doesNotMatch(s.url, /synthetic-iuphar-key/);
  } finally {
    delete process.env.IUPHAR_API_KEY;
  }
});

async function seedSource(
  identity: string,
  identifiers: Record<string, string>,
) {
  const id = z
    .object({ id: z.uuid() })
    .parse(
      (
        await db.owner.query(
          "INSERT INTO wiki.source(identity_key,source_type) VALUES($1,'curated_fixture') RETURNING id",
          [identity],
        )
      ).rows[0],
    ).id;
  for (const [namespace, value] of Object.entries(identifiers))
    await db.owner.query(
      "INSERT INTO wiki.source_identifier(source_id,namespace,value) VALUES($1,$2,$3)",
      [id, namespace, value],
    );
  // Curated sources already carry a manually recorded observation.
  await db.owner.query(
    "INSERT INTO wiki.source_observation(source_id,title,url,content_hash,text_scope,license_note) VALUES($1,$2,'https://example.invalid/curated',$3,'metadata','Synthetic curated fixture')",
    [id, `Curated ${identity}`, randomUUID()],
  );
  return id;
}
const candidate = (overrides: Record<string, unknown> = {}) => ({
  identity: "pmid-555001",
  type: "original_research_discovery",
  title: "Synthetic paper 555001",
  url: "https://pubmed.ncbi.nlm.nih.gov/555001/",
  scope: "metadata" as const,
  notes: JSON.stringify({ screening: "Unscreened." }),
  identifiers: { pmid: "555001", doi: "10.1000/synth.555001" },
  ...overrides,
});
const store = (item: ReturnType<typeof candidate>) =>
  database.transaction(null, (c) => research.storeObservation(c, item));

test("a rediscovered paper merges into the curated source with the same PMID", async () => {
  const curated = await seedSource("curated-fixture-paper", {
    pmid: "555001",
  });
  const first = await store(candidate());
  assert.equal(first.change, "baseline");
  const again = await store(candidate());
  assert.equal(again.change, "unchanged");
  assert.equal(again.id, first.id);
  const changed = await store(
    candidate({ title: "Synthetic paper, corrected" }),
  );
  assert.equal(changed.change, "changed");
  assert.notEqual(changed.id, first.id);
  const rows = await db.owner.query(
    "SELECT count(DISTINCT source_id)::int AS sources, count(*)::int AS observations FROM wiki.source_observation WHERE notes LIKE '%Unscreened%'",
  );
  assert.deepEqual(rows.rows[0], { sources: 1, observations: 2 });
  const owner = await db.owner.query(
    "SELECT source_id FROM wiki.source_identifier WHERE namespace='doi' AND value='10.1000/synth.555001'",
  );
  assert.equal(owner.rows[0].source_id, curated);
  assert.equal(
    (
      await db.owner.query(
        "SELECT 1 FROM wiki.source WHERE identity_key='pmid-555001'",
      )
    ).rowCount,
    0,
  );
});

test("a new source is reported new, and ambiguous identifiers need a human", async () => {
  const fresh = await store(
    candidate({
      identity: "pmid-555002",
      identifiers: { pmid: "555002" },
      url: "https://pubmed.ncbi.nlm.nih.gov/555002/",
    }),
  );
  assert.equal(fresh.change, "new");
  await seedSource("curated-fixture-a", { pmid: "555003" });
  await seedSource("curated-fixture-b", { doi: "10.1000/synth.555003" });
  await assert.rejects(
    store(
      candidate({
        identity: "pmid-555003",
        identifiers: { pmid: "555003", doi: "10.1000/synth.555003" },
      }),
    ),
    research.IdentifierConflict,
  );
  // The identity label points at one source and the identifier at another.
  await seedSource("pmid-555004", {});
  await seedSource("curated-fixture-c", { pmid: "555004" });
  await assert.rejects(
    store(
      candidate({ identity: "pmid-555004", identifiers: { pmid: "555004" } }),
    ),
    research.IdentifierConflict,
  );
});

async function queuePeptide(name: string) {
  const pid = randomUUID();
  await db.owner.query(
    "INSERT INTO wiki.peptide(id,canonical_name,slug) VALUES($1,$2,$3)",
    [pid, name, name.toLowerCase().replaceAll(" ", "-")],
  );
  const revision = z
    .object({ id: z.uuid() })
    .parse(
      (
        await db.owner.query(
          "INSERT INTO wiki.revision(peptide_id,status) VALUES($1,'researching') RETURNING id",
          [pid],
        )
      ).rows[0],
    ).id;
  const job = async () =>
    db.owner.query(
      "INSERT INTO wiki.research_job(peptide_id,revision_id,kind,dedupe_key) VALUES($1,$2,'discover',$3) RETURNING id",
      [pid, revision, randomUUID()],
    );
  return { pid, revision, job };
}
const noSearch = (query: string) => ({
  query,
  url: "https://example.invalid/search",
  total: 2,
  retrieved: 2,
  truncated: false,
  pages: 1,
});

test("a discovery job records queries, search scope, failures, skips and changes", async () => {
  const p = await queuePeptide("Fixture Beta");
  await db.owner.query(
    "INSERT INTO wiki.peptide_alias(peptide_id,alias,alias_type) VALUES($1,'Beta Brand','commercial'),($1,'Beta Code','research_code'),($1,'Beta Scientific','scientific')",
    [p.pid],
  );
  await db.owner.query(
    "INSERT INTO wiki.peptide_identifier(peptide_id,namespace,value) VALUES($1,'uniprot','P12345'),($1,'doi','10.1/ignored')",
    [p.pid],
  );
  let seen: AdapterContext | undefined;
  const item = candidate({
    identity: "pmid-777001",
    identifiers: { pmid: "777001" },
  });
  const adapters = [
    {
      label: "Working",
      run: async (ctx: AdapterContext) => {
        seen = ctx;
        return {
          found: [
            {
              source: item,
              queries: ['"Fixture Beta"', '"Fixture Beta" human'],
            },
          ],
          searches: [
            noSearch('"Fixture Beta"'),
            noSearch('"Fixture Beta" human'),
          ],
        };
      },
    },
    {
      label: "Broken",
      run: async () => {
        throw new Error("Source HTTP 503");
      },
    },
    {
      label: "Keyless",
      run: async () => ({
        found: [],
        searches: [],
        skipped: "No key configured.",
      }),
    },
  ];
  const first = await p.job();
  assert.equal(await research.runDiscoveryJob({ adapters }), true);
  assert.deepEqual(seen?.aliases, [
    "Beta Scientific",
    "Beta Code",
    "Beta Brand",
  ]);
  assert.deepEqual(seen?.seeds, { uniprot: "P12345" });
  const job = await db.owner.query(
    "SELECT state FROM wiki.research_job WHERE id=$1",
    [first.rows[0].id],
  );
  assert.equal(job.rows[0].state, "succeeded");
  const queries = await db.owner.query(
    "SELECT query FROM wiki.discovery WHERE job_id=$1 ORDER BY query",
    [first.rows[0].id],
  );
  assert.deepEqual(
    queries.rows.map((r) => r.query),
    ['"Fixture Beta"', '"Fixture Beta" human'],
  );
  const statuses = await db.owner.query(
    "SELECT status,count(*)::int AS n FROM wiki.retrieval_receipt WHERE job_id=$1 GROUP BY status ORDER BY status",
    [first.rows[0].id],
  );
  assert.deepEqual(statuses.rows, [
    { status: "failed", n: 1 },
    { status: "retrieved", n: 1 },
    { status: "searched", n: 2 },
    { status: "skipped", n: 1 },
  ]);
  const task = await db.owner.query(
    "SELECT reason FROM wiki.review_task WHERE job_id=$1",
    [first.rows[0].id],
  );
  assert.match(task.rows[0].reason, /1 new, 0 changed/);
  assert.match(task.rows[0].reason, /Acquisition failed for Broken/);
  assert.match(task.rows[0].reason, /Skipped Keyless/);
  // A later refresh sees the identical snapshot as unchanged, then a corrected one as changed.
  const second = await p.job();
  await research.runDiscoveryJob({ adapters });
  const unchanged = await db.owner.query(
    "SELECT reason FROM wiki.review_task WHERE job_id=$1",
    [second.rows[0].id],
  );
  assert.match(
    unchanged.rows[0].reason,
    /0 new, 0 changed since the last snapshot, 0 newly tracked, 1 unchanged/,
  );
  const corrected = {
    ...item,
    title: "Synthetic paper 777001, corrected title",
  };
  adapters[0].run = async () => ({
    found: [{ source: corrected, queries: ['"Fixture Beta"'] }],
    searches: [],
  });
  const third = await p.job();
  await research.runDiscoveryJob({ adapters });
  const changed = await db.owner.query(
    "SELECT reason FROM wiki.review_task WHERE job_id=$1",
    [third.rows[0].id],
  );
  assert.match(changed.rows[0].reason, /0 new, 1 changed/);
  // Discovery never creates claims or approvals.
  assert.equal(
    (
      await db.owner.query("SELECT 1 FROM wiki.claim WHERE revision_id=$1", [
        p.revision,
      ])
    ).rowCount,
    0,
  );
});

test("a job fails only when every attempted source fails; conflicts are surfaced, not fatal", async () => {
  const p = await queuePeptide("Fixture Gamma");
  const broken = (label: string) => ({
    label,
    run: async () => {
      throw new Error("Source HTTP 500");
    },
  });
  const all = await p.job();
  await research.runDiscoveryJob({
    adapters: [
      broken("One"),
      broken("Two"),
      {
        label: "Skipped",
        run: async () => ({ found: [], searches: [], skipped: "off" }),
      },
    ],
  });
  assert.equal(
    (
      await db.owner.query("SELECT state FROM wiki.research_job WHERE id=$1", [
        all.rows[0].id,
      ])
    ).rows[0].state,
    "failed",
  );
  await seedSource("curated-gamma-a", { pmid: "888001" });
  await seedSource("curated-gamma-b", { doi: "10.1000/synth.888001" });
  const mixed = await p.job();
  await research.runDiscoveryJob({
    adapters: [
      {
        label: "Ambiguous",
        run: async () => ({
          found: [
            {
              source: candidate({
                identity: "pmid-888001",
                identifiers: { pmid: "888001", doi: "10.1000/synth.888001" },
              }),
              queries: ["q"],
            },
            {
              source: candidate({
                identity: "pmid-888002",
                identifiers: { pmid: "888002" },
              }),
              queries: ["q"],
            },
          ],
          searches: [],
        }),
      },
    ],
  });
  const row = await db.owner.query(
    "SELECT state FROM wiki.research_job WHERE id=$1",
    [mixed.rows[0].id],
  );
  assert.equal(row.rows[0].state, "succeeded");
  const task = await db.owner.query(
    "SELECT reason FROM wiki.review_task WHERE job_id=$1",
    [mixed.rows[0].id],
  );
  assert.match(task.rows[0].reason, /1 new/);
  assert.match(
    task.rows[0].reason,
    /Identifier conflicts need resolution: pmid-888001/,
  );
});
