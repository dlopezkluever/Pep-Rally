# Peppy Tides

A local peptide research platform with one normalized PostgreSQL knowledge base, two reading views, source acquisition, and human editorial review.

The prepared application runs at **http://127.0.0.1:3048**. The research workspace is at **http://127.0.0.1:3048/admin**. Local sign-in credentials are in `.env.local`, under `EDITOR_EMAIL` and `EDITOR_PASSWORD`.

There are 22 identities, five unreviewed validation dossiers, four structured registry snapshots, and no scientific publications. The public library stays empty until a human editor completes review. The scientific MVP acceptance criteria are not complete.

## Run the prepared workspace

The local database container is `peppy-tides-db`, bound to port 55438. Start it if needed:

```powershell
docker start peppy-tides-db
npm install
npm run db:migrate
npm run build
npm start
```

Open `/women` for the editorial reading view or `/50plus` for larger text and controls. Both use the same article, evidence, safety, regulatory, and citation records. Development mode is `npm run dev`.

## Set up a new local database

Use Node.js 22.16 or later, npm, and Docker. Copy `.env.example` to `.env.local` and replace each password with a distinct random value. Set `MIGRATION_DATABASE_URL` to the database owner, `DATABASE_URL` to `peppy_server`, and `WORKER_DATABASE_URL` to `peppy_worker`. The migration owner's password must match `POSTGRES_PASSWORD`.

```powershell
docker compose --env-file .env.local up -d
npm ci
npm run db:migrate
npm run db:setup-local
npm run db:seed
npm run db:seed-trials
npm run build
npm start
```

`db:setup-local` provisions separate web and worker logins. `db:seed` creates the local editor and draft corpus without approving content. `db:seed-trials` retrieves four exact registry records into drafts. It needs network access and leaves existing imported snapshots unchanged. Keep the migration password out of the web and worker deployments.

## Research and review

Use the **Research queue** to inspect sources, ingest permitted passages, add claims and study metadata, classify evidence, and record review decisions. Exact source locators and limitations are required. Check observations without stored text through their original source links.

Review each claim, the five evidence dimensions, safety findings, explicit unknowns, and jurisdiction-specific regulation. Submit the revision and publish it as an authenticated human editor. The database rejects incomplete or unauthorized publication. Wording and citation edits invalidate approval. Reload a stale review tab. Published scientific rows and identities are immutable; updates start a new revision, and urgent withdrawal removes the public pointer. **Start a new revision from this one** copies claims, citations, evidence, safety, regulatory, taxonomy, and relation records into a draft. It clears every claim approval and every assessment reviewer, so an editor must re-review everything before it can publish. A peptide can have one open draft at a time. Relations to other peptides are added with a supporting claim and appear publicly only when the related peptide is published.

AI-generated research must not be approved by an agent using the local editor account. The generated credentials enable human inspection, not automated editorial sign-off.

### Acquire source metadata

```powershell
node --env-file=.env.local --import tsx scripts/queue-research.ts "BPC-157" "BPC157"
node --env-file=.env.local --import tsx scripts/worker.ts --once
```

The queue accepts a canonical name, optional aliases, and optional `--pubchem=CID`, `--uniprot=ACCESSION`, or `--iuphar=LIGAND_ID` seeds. It resolves existing normalized names and aliases and rejects ambiguity. Seed identifiers are research inputs, not proof of molecular equivalence.

The worker queries PubMed, ClinicalTrials.gov, PubChem, openFDA, RCSB PDB, UniProt, and IUPHAR. It stores unscreened metadata and review tasks. It does not convert search matches into eligible-study counts, grades, approval labels, or claims.

PubMed runs the ten PRD query forms for the canonical name (the bare name, then human, clinical trial, randomized, pharmacokinetics, mechanism, safety, toxicity, animal, and review), plus the bare name and human queries for up to four aliases. Scientific names and codes are searched before commercial names. Queries page up to a per-query limit, so a broad name retrieves a bounded sample. Every search is saved as a `searched` receipt with the service's reported total, the number retrieved, and a `truncated` flag, so a reviewer can see what was and was not covered. One paper matched by several queries is a single source that records each query.

The same PMID, DOI, or NCT ID always resolves to one source, whatever label a curated import gave it. Identifiers that point at two different sources are reported as conflicts in the review task instead of being guessed. The review task also counts sources that are new, changed since the last snapshot, newly tracked, or unchanged, which is how a refresh surfaces new papers and trial status changes.

RCSB and UniProt results are structure and protein candidates for identity review: a precursor protein is not the mature peptide. IUPHAR needs `IUPHAR_API_KEY`; without one it is recorded as skipped and does not fail the job. Its adapter follows the published service documentation and has not been run against a live key.

`npm run research:refresh` queues published records whose review date is due. Schedule it and the worker in your deployment. It creates review tasks rather than updating published science. Source feasibility probes are in `python scripts/probe_sources.py`. Set `NCBI_EMAIL` and `NCBI_API_KEY` for PubMed, and `OPENFDA_API_KEY` for openFDA, before scheduled use.

### Configure AI extraction

Set `AI_EXTRACTION_URL` to a provider adapter accepting the contract in `HttpExtractionProvider` and returning its JSON schema. Set `AI_EXTRACTION_KEY` if required. No vendor credential is bundled. Source text requires a recorded permission basis before extraction. Validated interpretations and draft claims remain separate from the original passage and never receive automatic approval.

## Verify

```powershell
npx playwright install chromium
npm run typecheck
npm run build
npm test
node --env-file=.env.local scripts/audit-provenance.mjs
npm audit
```

Tests create uniquely named disposable databases and a server on port 3049. Test modules that touch the database must set `DATABASE_URL` before importing it, and the acquisition and revision tests assert they are connected to the disposable database. They exercise real PostgreSQL constraints, browser search and citations, comparison, audience parity, sign-in, publication, stale review rejection, concurrent review changes, and automated accessibility checks. Synthetic fixtures never enter the working knowledge base. The test owner needs permission to create and drop its test database.

## Continue development

Read [architecture](docs/architecture.md), [data model](docs/data-model.md), [research sources](docs/research-sources.md), [evidence rubric](docs/evidence-rubric.md), [compliance model](docs/compliance-model.md), and [validation corpus](docs/validation-corpus.md). [Progress](docs/progress.md) and [quality](docs/quality.md) distinguish implementation from content and production readiness.

Deployment needs human scientific review, expanded full-text research, production identities and secrets, hosting, an acquisition schedule, and source-specific rights and freshness compliance. ClinicalTrials.gov redistribution requires attribution, current data, its processing date, and disclosure of modifications. The private historical snapshots are not a complete production redistribution solution.
