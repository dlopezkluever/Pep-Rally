# Research acquisition sources

Research date: 2026-10-18. Live transport observations: 16:54:06–16:54:09 UTC. This document records Phase 0 source feasibility, not a scientific evidence review or approval of any peptide claim.

## Reproducible observations

Run `python scripts/probe_sources.py` from the project root. The standard-library script makes eight small sequential requests, using no API keys, and replaces `research/api-probes.json`. It stores request URLs, timestamps, statuses, response hashes, selected headers, schema keys, and small response extracts. The extracts are availability evidence; the complete upstream responses are not archived. These probes do not establish long-term availability, complete coverage, or scientific correctness.

| Source/probe                              | Observed result | Concrete observation                                                                                      |
| ----------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| PubMed ESearch, `elamipretide`            | 200 JSON        | `esearchresult.count=362`, two IDs returned, query expansion recorded                                     |
| PubMed EFetch, PMID 29718389              | 200 XML         | `PubmedArticleSet`; abstract exists; full-text body absent                                                |
| ClinicalTrials.gov v2, intervention query | 200 JSON        | NCT02788747; protocol, results, document and derived sections; `hasResults=true`; next-page token         |
| PubChem name/property query               | 200 JSON        | Oxytocin resolves to CID 439302; formula, weight and InChIKey present; throttle header green              |
| IUPHAR ligand name query                  | **401**         | Response says API key missing; registration and key request required                                      |
| openFDA Drugs@FDA ingredient query        | 200 JSON        | NDA210557; products, submissions, sponsor and harmonization fields; upstream `last_updated=2026-10-16`    |
| RCSB entry 1AON                           | 200 JSON        | Entry, entity/assembly identifiers and PubMed linkage fields                                              |
| UniProt P01178                            | 200 JSON        | Reviewed human entry; sequence length 125; release 2026_03; PDB and many other cross-reference namespaces |

Counts are search matches, never counts of human studies or independent experiments. A registry results section is distinct from a peer-reviewed publication. Probe selection does not designate the records as validation-corpus evidence.

## Source contracts and boundaries

### PubMed and NCBI

Use ESearch for reproducible query discovery, ESummary for metadata and EFetch XML for article metadata/abstracts. Preserve the submitted query and translated query; aliases expand recall but require screening. Batch IDs instead of one request per paper. ELink can help locate related NCBI records. See [NLM E-utilities documentation](https://www.nlm.nih.gov/dataguide/eutilities/utilities.html).

Unauthenticated E-utilities are limited to three requests/second per IP; a key normally permits ten. Include a real operator email and tool identifier in a deployed integration. The probe supplies only a tool identifier; production configuration must supply the operator contact. [NCBI API keys](https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/), [NCBI preferences/API limits](https://www.ncbi.nlm.nih.gov/books/NBK53593/).

PubMed is an index and abstract service. Full text needs a publisher link or a separately acquired PMC article. Free-to-read does not imply permission to redistribute. NCBI asks services to display its disclaimer/copyright notice; abstracts and contributed PubChem material can retain third-party rights. Store original abstract text privately only under an assessed permission basis; publish original summaries and citations with any required notices. [NCBI usage and copyright policy](https://www.ncbi.nlm.nih.gov/home/about/policies/).

Join PMID to DOI and PMCID when explicitly supplied. DOI normalization must preserve the identifier after removing a resolver prefix. Absence of a DOI, abstract, species tag, or publication-type annotation means missing metadata, not negative scientific evidence. Publication-type tags assist triage; editors determine design from source text.

### ClinicalTrials.gov

Use `/api/v2/studies`, intervention/name searches, explicit field selection and next-page tokens; fetch individual NCT records for normalized ingestion. The observed result confirms structured protocol/results access. REST v2 uses JSON, standardized fields and ISO dates; legacy API documentation should not guide new adapters. [NLM v2 announcement](https://www.nlm.nih.gov/pubs/techbull/ma24/ma24_clinicaltrials_api.html), [API reference](https://clinicaltrials.gov/data-api/api).

Keep NCT ID as a unique registry-scoped identifier. Retain enrollment as actual/estimated, outcome definitions, start/completion date precision, study status and update date. Link publications only through explicit NCT/PMID/DOI relationships or documented editorial review. Protocol, reported results, analysis population and publications may differ; a registered, completed or recruiting trial does not establish efficacy.

The API information and terms initially returned a JavaScript shell in the text browser. A subsequent rendered-browser inspection succeeded on 2026-10-18; transport evidence is in `research/source-terms-rendered.json`. The [terms](https://clinicaltrials.gov/about-site/terms-conditions) require attribution, current data, the ClinicalTrials processing date, and disclosure of modifications. They prohibit proprietary ownership claims and promotional use of extracted email addresses. Third-party and international rights can apply. The project stores selected private snapshots; production redistribution requires current-data refresh and processing-date display. A numeric API rate limit remains unverified. The adapter uses a shared database budget of one request every two seconds per host as a project policy, not a claimed service limit.

### PubChem

PUG REST supports name-to-CID discovery, properties, synonyms and structure operations. Prefer exact reviewed CIDs after identity resolution. The service asks clients to stay below five requests/second, supplies throttling signals and can return 503 or HTML during overload. Use conservative pacing, JSON content checks and bounded retries. [PUG REST specification](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest).

CID identifies a standardized structure; SID identifies a deposited substance. Preserve both where relevant, together with stereochemistry, salt/form, modifications, sequence and InChIKey. Name matches are candidates. PubChem's own authors explain that consensus synonym filtering cannot guarantee a correct name-to-structure assignment. [PubChem synonym filtering study](https://pubmed.ncbi.nlm.nih.gov/38880887/).

PubChem aggregates depositor annotations, so a safety or mechanism annotation must retain its original contributor/reference. Availability through NIH does not grant unrestricted reuse of every contributed item; apply the [NCBI policies](https://www.ncbi.nlm.nih.gov/home/about/policies/) and record source-specific rights. PubChem identity/chemistry metadata is not clinical efficacy evidence.

### IUPHAR/BPS Guide to Pharmacology

The current API documents families, targets, genes, ligands, interactions and annotations. It now requires a registered account and requested API key, preferably sent in `GTP-API-Key` header. The observed 401 confirms that anonymous API access must not be assumed. No account was created. [Official REST API](https://www.guidetopharmacology.org/webServices.jsp).

Downloadable ligand/target/interaction tables and identifier mappings are an alternative; their current access path still needs an actual authenticated/download probe. The database is ODbL; contents use CC BY-SA 4.0. Preserve release, attribution and the boundary between imported data and original summaries. Assess share-alike/derivative-database obligations before shipping a merged redistributable dataset. A numeric rate limit was not established; request one with the key. [Download and licensing documentation](https://www.guidetopharmacology.org/download.jsp).

Store ligand IDs separately from target IDs. Ligand-to-CID and target-to-UniProt mappings may assist identity resolution, but must be versioned and reviewed. Pharmacology interaction records can support a target/assay claim after reviewing species and assay context; they do not establish human clinical benefit.

### FDA, Drugs@FDA and openFDA

The Drugs@FDA JSON endpoint provides applications, products and submissions, with harmonized identifiers where available; its official documentation says updates occur weekdays. It covers most approvals since 1939 and has more documents for approvals since 1998. This is incomplete coverage, so zero results cannot prove nonapproval. [Endpoint overview](https://open.fda.gov/apis/drug/drugsfda/), [query documentation](https://open.fda.gov/apis/drug/drugsfda/how-to-use-the-endpoint/).

openFDA documents 240 requests/minute and 1,000/day per IP without a key, or 120,000/day per key. The authentication page also describes a key as required, while this anonymous probe succeeded; provision a free key for a production worker and retain fallback/error handling. [Authentication policy](https://open.fda.gov/apis/authentication/).

FDA also publishes weekday-updated tabular Drugs@FDA downloads with table definitions. Application/product/submission identifiers permit joins to authoritative action documents. [FDA data files and schema](https://www.fda.gov/drugs/drug-approvals-and-databases/drugsfda-data-files). Follow approval letters and current labeling before writing an indication-specific regulatory statement. FDA notices, warnings, compounding material and assessment documents require separate official-page/document retrieval and dated review; there is no demonstrated universal peptide regulatory API here.

Use application number plus product/formulation and indication context, jurisdiction, action date, source document and verification date. A label/NDC listing is not sufficient proof of approval. Keep compound identity separate from a particular approved drug product. openFDA data generally use CC0 unless otherwise noted; do not imply endorsement and preserve exceptions. [openFDA license](https://open.fda.gov/license/).

### RCSB PDB

Search API discovers identifiers; REST/GraphQL Data API retrieves entry/entity annotations, sequences, methods and citations. Structures and computed models must remain distinct. Entity and chain IDs are not interchangeable with a molecule name or whole entry. [API overview](https://www.rcsb.org/docs/programmatic-access/web-apis-overview).

Current overview documents rate limits/429 and recommends a handful of requests/second; older Data API guidance says no rate limit. Follow the stricter overview, pace conservatively and cache. API data and PDB archive files use CC0, with attribution to structure authors encouraged. Other website prose and illustrations have separate rights. [RCSB usage policy](https://www.rcsb.org/pages/usage-policy).

Use PDB entry/entity/chain plus explicit UniProt mappings and source citations. A resolved or modeled structure supports structural context; it cannot alone establish mechanism in humans, safety or efficacy.

### UniProt

REST entry retrieval succeeded, including sequence/features, references and PDB cross-references; release headers are worth persisting. Search, field selection and identifier mapping should be adapter capabilities, but were not smoke-tested here. [Official API help](https://www.uniprot.org/help/api_queries). Numeric rate limits were not verified: begin with conservative pacing and backoff rather than invent a quota.

UniProt copyrightable database material uses CC BY 4.0, subject to possible other rights; retain attribution and identify adaptations. The help site's REST representation exposes the policy even when the HTML frontend requires JavaScript. [License and disclaimer](https://rest.uniprot.org/help/license).

Store accession, organism, reviewed status, release, features and references. A precursor protein sequence is not automatically the mature active peptide: the observed P01178 sequence is 125 residues. Resolve processed peptide coordinates, modifications and species explicitly before joining a peptide sequence to a UniProt entry. Reviewed database annotation is distinct from a clinical study.

## Acquisition and publication policy

These are proposed project controls rather than claims about external services:

1. Resolve identity using reviewed identifiers and structure/sequence context before broad literature ingestion. Preserve ambiguous candidates for review.
2. Persist retrieval URL/query, timestamp, response hash, source release/update time, permitted source snapshot, adapter version and license basis. A hash without retained permitted bytes proves only fingerprint equality, not recoverable provenance.
3. Deduplicate papers by PMID/DOI and trials by registry/NCT. A paper and its registry entry may describe the same study; evidence counts must reflect this.
4. Record source text availability as metadata-only, abstract-only, full-text or registry-results. Extraction must cite a source locator and explicitly state its text scope. Abstract-only review cannot silently become a full-text assessment.
5. Separate discovery matches, structured metadata, extracted observations, model interpretations and editor-approved claims. None of these APIs approves publication.
6. Retry transient network/429/5xx failures with bounded exponential backoff and jitter; honor Retry-After; do not retry a 401 as if it were transient. Persist failed runs and create review tasks for source changes.
7. Publish source links and required attribution. Keep restricted text out of public payloads. Compare snapshots to generate editorial update tasks; never replace approved claims automatically.

## Implemented adapters

`src/lib/adapters.ts` holds one adapter per source behind a shared transport (`src/lib/source-http.ts`: approved hosts only, HTTPS only, no redirects, a database-backed per-host pace of one request every two seconds, bounded retries, a 5 MB response cap). Search wording comes from `src/lib/query-plan.ts`. PubMed pages with `retstart`; ClinicalTrials.gov follows `nextPageToken`; RCSB uses the search service for identifiers and one GraphQL batch for titles, methods, release dates, and citation links; UniProt searches reviewed entries and reads release headers; IUPHAR sends `GTP-API-Key` and is skipped without a key. A service answering 404 or 204 for no matches yields an empty result, while 5xx is a failure.

Seed identifiers given at queue time (`--pubchem`, `--uniprot`, `--iuphar`) trigger an exact lookup recorded as its own query. A seed remains a research input, never proof of molecular equivalence.

## Remaining source-validation work

Before operational bulk ingestion: obtain an IUPHAR key or confirm downloadable access and rights handling, then run its adapter live; complete ClinicalTrials processing-date and current-data obligations (the article now shows attribution and a retrieval date but not the registry's processing date); verify its quota; verify UniProt API usage guidance; add real operator contact configuration; probe conditional requests, document retrieval, and update windows. The UniProt rendered page timed out. Full-text permissions and FDA document interpretation need record-specific review. These gaps allow private drafts but prevent claiming a complete autonomous acquisition service.
