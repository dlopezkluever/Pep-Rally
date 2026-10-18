# Implementation progress

The requirements are in `../init-prompt.txt`. Scientific research produced by agents remains unreviewed until a human editor approves it.

## Architecture workflow

- [x] Ground: greenfield directory, no application to integrate.
- [x] Sketch: independent relational and event sourced designs, plus a Claude candidate.
- [x] Agree: synthesized without an approval checkpoint, as authorized.
- [x] Implement: migrations and local application.
- [x] Review for repeated structural problems: no redesign required; stale-review tokens added.

## Design comparison workflow

- [x] Frame: assess provenance integrity, publication isolation, authorization, operational simplicity, and queryability.
- [x] Fan out: independent design candidates.
- [x] Cross judge: independent Claude review.
- [x] Pick: scores in `design/synthesis.md`.
- [x] Graft: revision isolation, relational editing, and audit journal.
- [x] Verify: fresh migrations, policy checks, and browser flows.

## Product phases

- [x] Phase 0: source inspection, architecture, normalized schema, rubric, five draft dossiers.
- [x] Phase 1: core data platform, 22 identities, five draft research records.
- [ ] Phase 2: seven discovery adapters (PubMed, ClinicalTrials.gov, PubChem, openFDA, RCSB PDB, UniProt, IUPHAR), the PRD query set with alias expansion and pagination, per-search scope receipts, source-identity merging, change detection, provenance, job leases, shared pacing, optional structured AI contract, and refresh queue implemented. The six keyless adapters ran against the live services. IUPHAR is implemented from its documentation and skips without a key, so it has never run live. Source-text acquisition, live AI configuration, and deeper per-source search strategies remain.
- [x] Phase 3, local software: authentication, reviews, publication checks, audit, withdrawal, and revision creation, including carry-forward of an earlier revision with every approval cleared.
- [x] Phase 4, local software: public wiki renderer, home, library, citations, and evidence guide. Real publications require human review.
- [x] Phase 5, local software: search, taxonomy, comparison, related-data rendering, and a relation form with a database guard against self-relation.
- [x] Phase 6: shared scientific data with two reading profiles.
- [ ] Phase 7: local build, database, browser, responsive, automated accessibility, security, and provenance checks completed. A per-request nonce script policy and ClinicalTrials.gov attribution are in place. Production deployment and manual accessibility audits remain.

## External prerequisites

The full scientific MVP is incomplete. Expanded source appraisal and human editorial review remain required. Production hosting, identity lifecycle, secrets, and worker scheduling are not configured. ClinicalTrials current-data and processing-date obligations need a production publication strategy. IUPHAR requires a key. No real peptide claim has been human-approved or published during this run.
