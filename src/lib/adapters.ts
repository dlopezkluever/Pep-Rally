import { z } from "zod";
import { normalizeDoi } from "./domain";
import { buildLiteratureQueryPlan, searchSubjects } from "./query-plan";
import {
  type Adapter,
  type DiscoverySource,
  type FoundSource,
  type SearchRecord,
  orEmptyOn404,
  sourceSchema,
} from "./source-http";

/**
 * Every adapter retrieves unscreened candidates. A match is never an eligible
 * study, an identity decision, an approval, or a claim; each source's
 * `screening` note says what a human must still establish.
 */
function redacted(url: URL) {
  const copy = new URL(url);
  for (const secret of ["api_key", "email"]) copy.searchParams.delete(secret);
  return copy.toString();
}
class Collector {
  private items = new Map<string, FoundSource>();
  add(source: DiscoverySource, query: string) {
    const existing = this.items.get(source.identity);
    if (!existing)
      this.items.set(source.identity, { source, queries: [query] });
    else if (!existing.queries.includes(query)) existing.queries.push(query);
  }
  get found() {
    return [...this.items.values()];
  }
}
const searchedOnly = (
  record: Omit<SearchRecord, "truncated"> & { truncated?: boolean },
): SearchRecord => ({
  ...record,
  truncated: record.truncated ?? (record.total ?? 0) > record.retrieved,
});

// PubMed ---------------------------------------------------------------
const pubmedSearch = z.object({
  esearchresult: z.object({
    count: z.coerce.number(),
    idlist: z.array(z.string()),
    querytranslation: z.string().optional(),
  }),
});
const paperSchema = z.object({
  uid: z.string(),
  title: z.string(),
  fulljournalname: z.string().optional(),
  pubdate: z.string().optional(),
  pubtype: z.array(z.string()).optional(),
  articleids: z
    .array(z.object({ idtype: z.string(), value: z.string() }))
    .optional(),
});
const pubmedPageSize = 20;
function pubmedUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${path}`);
  const all: Record<string, string> = {
    db: "pubmed",
    retmode: "json",
    tool: "peppy_tides",
    ...(process.env.NCBI_EMAIL ? { email: process.env.NCBI_EMAIL } : {}),
    ...(process.env.NCBI_API_KEY ? { api_key: process.env.NCBI_API_KEY } : {}),
    ...params,
  };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  return url;
}
export const discoverPubMed: Adapter = async (ctx) => {
  const matches = new Map<string, string[]>();
  const searches: SearchRecord[] = [];
  for (const q of buildLiteratureQueryPlan(ctx.name, ctx.aliases)) {
    const ids: string[] = [];
    let total = 0;
    let pages = 0;
    let translation: string | undefined;
    let url = pubmedUrl("esearch.fcgi", { term: q.text });
    while (ids.length < q.limit) {
      url = pubmedUrl("esearch.fcgi", {
        term: q.text,
        retmax: String(Math.min(pubmedPageSize, q.limit - ids.length)),
        retstart: String(ids.length),
      });
      const page = pubmedSearch.parse(
        (await ctx.fetch(url)).body,
      ).esearchresult;
      pages++;
      total = page.count;
      translation ??= page.querytranslation;
      if (!page.idlist.length) break;
      ids.push(...page.idlist);
      if (ids.length >= total) break;
    }
    for (const id of ids) matches.set(id, [...(matches.get(id) ?? []), q.text]);
    searches.push(
      searchedOnly({
        query: q.text,
        url: redacted(url),
        total,
        retrieved: ids.length,
        pages,
        translation,
      }),
    );
  }
  const collector = new Collector();
  const unique = [...matches.keys()];
  for (let start = 0; start < unique.length; start += 100) {
    const batch = unique.slice(start, start + 100);
    const summary = z
      .object({ result: z.record(z.string(), z.unknown()) })
      .parse(
        (await ctx.fetch(pubmedUrl("esummary.fcgi", { id: batch.join(",") })))
          .body,
      );
    for (const id of batch) {
      const p = paperSchema.parse(summary.result[id]);
      const doi = p.articleids?.find((i) => i.idtype === "doi")?.value;
      const source = sourceSchema.parse({
        identity: `pmid-${p.uid}`,
        type: "original_research_discovery",
        title: p.title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${p.uid}/`,
        scope: "metadata",
        notes: JSON.stringify({
          publication: p.fulljournalname,
          date: p.pubdate,
          publicationTypes: p.pubtype ?? [],
          screening:
            "Unscreened discovery match; no evidence classification or claim extracted. Publication-type tags assist triage only; design is established from source text.",
        }),
        identifiers: {
          pmid: p.uid,
          ...(doi ? { doi: normalizeDoi(doi) } : {}),
        },
      });
      for (const query of matches.get(id) ?? []) collector.add(source, query);
    }
  }
  return { found: collector.found, searches };
};

// ClinicalTrials.gov ---------------------------------------------------
const trialDiscovery = z.object({
  totalCount: z.number().optional(),
  nextPageToken: z.string().optional(),
  studies: z.array(
    z.object({
      protocolSection: z
        .object({
          identificationModule: z.object({
            nctId: z.string().regex(/^NCT\d{8}$/),
            briefTitle: z.string(),
          }),
          statusModule: z.object({ overallStatus: z.string() }).passthrough(),
          designModule: z.unknown().optional(),
        })
        .passthrough(),
      hasResults: z.boolean().optional(),
    }),
  ),
});
const trialPageSize = 25;
export const discoverTrials: Adapter = async (ctx) => {
  const collector = new Collector();
  const searches: SearchRecord[] = [];
  const subjects = searchSubjects(ctx.name, ctx.aliases);
  for (const [index, subject] of subjects.entries()) {
    const limit = index === 0 ? 50 : 20;
    const query = `intervention: ${subject}`;
    let retrieved = 0;
    let total: number | null = null;
    let pages = 0;
    let token: string | undefined;
    let url = new URL("https://clinicaltrials.gov/api/v2/studies");
    do {
      url = new URL("https://clinicaltrials.gov/api/v2/studies");
      url.searchParams.set("query.intr", subject);
      url.searchParams.set(
        "pageSize",
        String(Math.min(trialPageSize, limit - retrieved)),
      );
      url.searchParams.set("format", "json");
      url.searchParams.set("countTotal", "true");
      if (token) url.searchParams.set("pageToken", token);
      const page = trialDiscovery.parse((await ctx.fetch(url)).body);
      pages++;
      total ??= page.totalCount ?? null;
      for (const s of page.studies) {
        const id = s.protocolSection.identificationModule;
        collector.add(
          {
            identity: `ctgov-${id.nctId}`,
            type: "trial_registry",
            title: id.briefTitle,
            url: `https://clinicaltrials.gov/study/${id.nctId}`,
            scope: "registry",
            notes: JSON.stringify({
              ...s,
              screening:
                "Registry discovery only. No molecular equivalence, conduct, approval, or efficacy inferred.",
            }),
            identifiers: { nct_id: id.nctId },
          },
          query,
        );
        retrieved++;
      }
      token = page.nextPageToken;
    } while (token && retrieved < limit);
    searches.push(
      searchedOnly({ query, url: url.toString(), total, retrieved, pages }),
    );
  }
  return { found: collector.found, searches };
};

// PubChem --------------------------------------------------------------
const pubchemProperties = z.object({
  PropertyTable: z.object({
    Properties: z.array(
      z
        .object({
          CID: z.number(),
          MolecularFormula: z.string(),
          MolecularWeight: z.union([z.string(), z.number()]),
          InChIKey: z.string(),
        })
        .passthrough(),
    ),
  }),
});
const pubchemFields = "MolecularFormula,MolecularWeight,InChIKey";
export const discoverChemistry: Adapter = async (ctx) => {
  const collector = new Collector();
  const searches: SearchRecord[] = [];
  const lookups: { query: string; path: string }[] = [
    ...searchSubjects(ctx.name, ctx.aliases).map((subject) => ({
      query: `name: ${subject}`,
      path: `name/${encodeURIComponent(subject)}`,
    })),
    ...(ctx.seeds.pubchem
      ? [
          {
            query: `seed identifier: pubchem CID ${ctx.seeds.pubchem}`,
            path: `cid/${encodeURIComponent(ctx.seeds.pubchem)}`,
          },
        ]
      : []),
  ];
  for (const lookup of lookups) {
    const url = new URL(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${lookup.path}/property/${pubchemFields}/JSON`,
    );
    const rows = await orEmptyOn404(
      ctx.fetch(url).then((r) => pubchemProperties.parse(r.body)),
      { PropertyTable: { Properties: [] } },
    );
    const kept = rows.PropertyTable.Properties.slice(0, 5);
    for (const p of kept)
      collector.add(
        {
          identity: `pubchem-${p.CID}`,
          type: "chemical_identity_candidate",
          title: `PubChem identity candidate, CID ${p.CID}`,
          url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,
          scope: "metadata",
          notes: JSON.stringify({
            properties: p,
            screening:
              "Name or seed-identifier match only. Exact structure, stereochemistry, salt, and sequence require human identity review.",
          }),
          identifiers: { pubchem_cid: String(p.CID) },
        },
        lookup.query,
      );
    searches.push(
      searchedOnly({
        query: lookup.query,
        url: url.toString(),
        total: rows.PropertyTable.Properties.length,
        retrieved: kept.length,
        pages: 1,
      }),
    );
  }
  return { found: collector.found, searches };
};

// openFDA Drugs@FDA ----------------------------------------------------
const fdaResults = z.object({
  meta: z
    .object({ results: z.object({ total: z.number().optional() }).optional() })
    .optional(),
  results: z.array(
    z.object({
      application_number: z.string(),
      sponsor_name: z.string().optional(),
      products: z.array(z.unknown()).optional(),
      submissions: z.array(z.unknown()).optional(),
    }),
  ),
});
export const discoverRegulatory: Adapter = async (ctx) => {
  const collector = new Collector();
  const searches: SearchRecord[] = [];
  for (const subject of searchSubjects(ctx.name, ctx.aliases)) {
    const query = `products.active_ingredients.name: ${subject}`;
    const url = new URL("https://api.fda.gov/drug/drugsfda.json");
    url.searchParams.set(
      "search",
      `products.active_ingredients.name:"${subject.replaceAll('"', "")}"`,
    );
    url.searchParams.set("limit", "5");
    if (process.env.OPENFDA_API_KEY)
      url.searchParams.set("api_key", process.env.OPENFDA_API_KEY);
    const data = await orEmptyOn404(
      ctx.fetch(url).then((r) => fdaResults.parse(r.body)),
      { results: [] },
    );
    for (const r of data.results)
      collector.add(
        {
          identity: `fda-application-${r.application_number}`,
          type: "regulatory_discovery",
          title: `Drugs@FDA application ${r.application_number}`,
          url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${r.application_number.replace(/\D/g, "")}`,
          scope: "regulatory",
          notes: JSON.stringify({
            application: r,
            screening:
              "Discovery only; inspect exact products, approval actions, and current labels. Drugs@FDA coverage is incomplete, so no match never shows a compound is unapproved.",
          }),
          identifiers: { fda_application: r.application_number },
        },
        query,
      );
    searches.push(
      searchedOnly({
        query,
        url: redacted(url),
        total: data.meta?.results?.total ?? data.results.length,
        retrieved: data.results.length,
        pages: 1,
      }),
    );
  }
  return { found: collector.found, searches };
};

// RCSB PDB -------------------------------------------------------------
const rcsbSearch = z
  .object({
    total_count: z.number(),
    result_set: z.array(z.object({ identifier: z.string() })),
  })
  .nullable();
const rcsbEntries = z.object({
  data: z.object({
    entries: z.array(
      z
        .object({
          rcsb_id: z.string(),
          struct: z.object({ title: z.string().nullable() }).nullish(),
          exptl: z.array(z.object({ method: z.string().nullable() })).nullish(),
          rcsb_accession_info: z
            .object({ initial_release_date: z.string().nullable() })
            .nullish(),
          rcsb_primary_citation: z
            .object({
              pdbx_database_id_PubMed: z.number().nullish(),
              pdbx_database_id_DOI: z.string().nullish(),
            })
            .nullish(),
        })
        .nullable(),
    ),
  }),
});
const rcsbRows = 10;
export const discoverStructures: Adapter = async (ctx) => {
  const matches = new Map<string, string[]>();
  const searches: SearchRecord[] = [];
  for (const subject of searchSubjects(ctx.name, ctx.aliases)) {
    const query = `full text: ${subject}`;
    const url = new URL("https://search.rcsb.org/rcsbsearch/v2/query");
    const { body } = await ctx.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: {
          type: "terminal",
          service: "full_text",
          parameters: { value: subject },
        },
        return_type: "entry",
        request_options: {
          paginate: { start: 0, rows: rcsbRows },
          results_content_type: ["experimental"],
        },
      }),
    });
    // The search service answers 204 with no body when nothing matches.
    const result = rcsbSearch.parse(body ?? null);
    const ids = result?.result_set.map((r) => r.identifier) ?? [];
    for (const id of ids) matches.set(id, [...(matches.get(id) ?? []), query]);
    searches.push(
      searchedOnly({
        query,
        url: url.toString(),
        total: result?.total_count ?? 0,
        retrieved: ids.length,
        pages: 1,
      }),
    );
  }
  const collector = new Collector();
  const ids = [...matches.keys()];
  for (let start = 0; start < ids.length; start += 25) {
    const batch = ids.slice(start, start + 25);
    const url = new URL("https://data.rcsb.org/graphql");
    url.searchParams.set(
      "query",
      `{entries(entry_ids:${JSON.stringify(batch)}){rcsb_id struct{title} exptl{method} rcsb_accession_info{initial_release_date} rcsb_primary_citation{pdbx_database_id_PubMed pdbx_database_id_DOI}}}`,
    );
    const details = rcsbEntries.parse((await ctx.fetch(url)).body);
    for (const entry of details.data.entries) {
      if (!entry) continue;
      const id = entry.rcsb_id.toUpperCase();
      const source: DiscoverySource = {
        identity: `pdb-${id}`,
        type: "structure_discovery_candidate",
        title: `PDB entry ${id}: ${entry.struct?.title ?? "untitled"}`,
        url: `https://www.rcsb.org/structure/${id}`,
        scope: "metadata",
        notes: JSON.stringify({
          methods: entry.exptl?.map((e) => e.method) ?? [],
          releaseDate: entry.rcsb_accession_info?.initial_release_date ?? null,
          primaryCitation: {
            pmid: entry.rcsb_primary_citation?.pdbx_database_id_PubMed ?? null,
            doi: entry.rcsb_primary_citation?.pdbx_database_id_DOI ?? null,
          },
          screening:
            "Full-text name match only. A structure may contain a related molecule, a complex partner, or a different form. It supports structural context, never identity, human mechanism, safety, or efficacy.",
        }),
        identifiers: { pdb_id: id },
      };
      for (const query of matches.get(entry.rcsb_id) ?? [])
        collector.add(source, query);
    }
  }
  return { found: collector.found, searches };
};

// UniProt --------------------------------------------------------------
const uniprotEntry = z.object({
  primaryAccession: z.string(),
  uniProtkbId: z.string(),
  entryType: z.string().optional(),
  organism: z.object({ scientificName: z.string() }).optional(),
  proteinDescription: z
    .object({
      recommendedName: z
        .object({ fullName: z.object({ value: z.string() }) })
        .optional(),
      submissionNames: z
        .array(z.object({ fullName: z.object({ value: z.string() }) }))
        .optional(),
    })
    .optional(),
  sequence: z.object({ length: z.number() }).optional(),
});
const uniprotFields = "accession,id,protein_name,organism_name,length,reviewed";
const uniprotRows = 5;
function uniprotSource(e: z.infer<typeof uniprotEntry>): DiscoverySource {
  const description = e.proteinDescription;
  return {
    identity: `uniprot-${e.primaryAccession}`,
    type: "protein_database_candidate",
    title: `UniProtKB ${e.primaryAccession} (${e.uniProtkbId}): ${description?.recommendedName?.fullName.value ?? description?.submissionNames?.[0]?.fullName.value ?? "unnamed"}`,
    url: `https://www.uniprot.org/uniprotkb/${e.primaryAccession}/entry`,
    scope: "metadata",
    notes: JSON.stringify({
      entryType: e.entryType ?? null,
      organism: e.organism?.scientificName ?? null,
      sequenceLength: e.sequence?.length ?? null,
      screening:
        "Name or seed-identifier match only. Sequence length is the full entry: a precursor protein is not the mature peptide. Processed-peptide coordinates, modifications, and species require human review.",
    }),
    identifiers: { uniprot: e.primaryAccession },
  };
}
export const discoverProteins: Adapter = async (ctx) => {
  const collector = new Collector();
  const searches: SearchRecord[] = [];
  for (const subject of searchSubjects(ctx.name, ctx.aliases)) {
    const query = `reviewed protein name: ${subject}`;
    const url = new URL("https://rest.uniprot.org/uniprotkb/search");
    url.searchParams.set(
      "query",
      `("${subject.replaceAll('"', "")}") AND (reviewed:true)`,
    );
    url.searchParams.set("size", String(uniprotRows));
    url.searchParams.set("fields", uniprotFields);
    const { body, headers } = await ctx.fetch(url);
    const data = z.object({ results: z.array(uniprotEntry) }).parse(body);
    for (const e of data.results) collector.add(uniprotSource(e), query);
    searches.push(
      searchedOnly({
        query,
        url: url.toString(),
        total: Number(headers.get("x-total-results")) || data.results.length,
        retrieved: data.results.length,
        pages: 1,
        release: headers.get("x-uniprot-release") ?? undefined,
      }),
    );
  }
  if (ctx.seeds.uniprot) {
    const query = `seed identifier: uniprot ${ctx.seeds.uniprot}`;
    const url = new URL(
      `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(ctx.seeds.uniprot)}`,
    );
    url.searchParams.set("fields", uniprotFields);
    const { body, headers } = await ctx.fetch(url);
    collector.add(uniprotSource(uniprotEntry.parse(body)), query);
    searches.push(
      searchedOnly({
        query,
        url: url.toString(),
        total: 1,
        retrieved: 1,
        pages: 1,
        release: headers.get("x-uniprot-release") ?? undefined,
      }),
    );
  }
  return { found: collector.found, searches };
};

// IUPHAR/BPS Guide to Pharmacology -------------------------------------
// Anonymous access returns 401. This adapter runs only with IUPHAR_API_KEY.
// Its response shape follows the published service documentation and has not
// been exercised against a live key.
const iupharLigand = z
  .object({ ligandId: z.number(), name: z.string() })
  .passthrough();
export const discoverPharmacology: Adapter = async (ctx) => {
  const key = process.env.IUPHAR_API_KEY;
  if (!key)
    return {
      found: [],
      searches: [],
      skipped:
        "IUPHAR_API_KEY is not configured. Register at guidetopharmacology.org to request a key.",
    };
  const collector = new Collector();
  const searches: SearchRecord[] = [];
  const headers = { "GTP-API-Key": key };
  const run = async (query: string, url: URL, single: boolean) => {
    const { body } = await ctx.fetch(url, { headers });
    const rows = z
      .array(iupharLigand)
      .parse(body === null ? [] : single ? [body] : body)
      .slice(0, 10);
    for (const l of rows)
      collector.add(
        {
          identity: `iuphar-ligand-${l.ligandId}`,
          type: "pharmacology_database_candidate",
          title: `IUPHAR ligand ${l.ligandId}: ${l.name}`,
          url: `https://www.guidetopharmacology.org/GRAC/LigandDisplayForward?ligandId=${l.ligandId}`,
          scope: "metadata",
          notes: JSON.stringify({
            ligand: l,
            screening:
              "Name or seed-identifier match only. Database classification of a ligand is not FDA status, and an interaction record does not establish human clinical benefit.",
          }),
          identifiers: { iuphar_ligand: String(l.ligandId) },
        },
        query,
      );
    searches.push(
      searchedOnly({
        query,
        url: url.toString(),
        total: rows.length,
        retrieved: rows.length,
        pages: 1,
      }),
    );
  };
  for (const subject of searchSubjects(ctx.name, ctx.aliases)) {
    const url = new URL("https://www.guidetopharmacology.org/services/ligands");
    url.searchParams.set("name", subject);
    url.searchParams.set("type", "Peptide");
    await orEmptyOn404(run(`ligand name: ${subject}`, url, false), undefined);
  }
  if (ctx.seeds.iuphar)
    await run(
      `seed identifier: iuphar ligand ${ctx.seeds.iuphar}`,
      new URL(
        `https://www.guidetopharmacology.org/services/ligands/${encodeURIComponent(ctx.seeds.iuphar)}`,
      ),
      true,
    );
  return { found: collector.found, searches };
};

export const adapters: { label: string; run: Adapter }[] = [
  { label: "PubMed", run: discoverPubMed },
  { label: "ClinicalTrials.gov", run: discoverTrials },
  { label: "PubChem", run: discoverChemistry },
  { label: "FDA", run: discoverRegulatory },
  { label: "RCSB PDB", run: discoverStructures },
  { label: "UniProt", run: discoverProteins },
  { label: "IUPHAR", run: discoverPharmacology },
];
