# Local quality and remaining acceptance work

## Validation scope

The build uses Next.js 16.4.2, React 19.3.1, TypeScript, Zod, and PostgreSQL 17. Tests use a disposable database and explicitly synthetic fixtures. Real peptide records receive no test approvals.

The final log is in `research/test-results.txt`. Regenerate provenance counts with `node --env-file=.env.local scripts/audit-provenance.mjs`. Screenshots in `research/screenshots/live-*` show the real draft-only library. Other screenshots show isolated fixtures.

## Verified behavior

- Production compilation and TypeScript checking.
- Fresh migrations and repeated migration execution without changes.
- Anonymous draft isolation and authenticated preview.
- Researcher approval denial and fixed nonhuman worker identity.
- Approval invalidation after wording or citation edits.
- Database rejection of preclinical-to-human efficacy extrapolation.
- Completed-search requirement for None Identified.
- Publication rollback on missing dimensions or unresolved flags.
- Referential integrity across revisions, citations, trials, and evidence.
- Concurrent review changes during publication, with rejection of revoked approval.
- Publication idempotency and frozen child-row protection.
- Alias normalization, fuzzy search, area filtering, and withdrawal.
- Structured AI interpretations saved as unreviewed claims only.
- Browser search, article, citation, comparison, audience parity, mobile overflow, sign-in, publication, sitemap, and origin checks.
- Automated axe checks on both homepages and a draft workspace. Initial small-label contrast failures were corrected.
- Adapter behavior with an injected transport: query plan and alias bounds, PubMed and ClinicalTrials pagination, truncation reporting, empty results from 404 and 204, credentials never written to search records, UniProt release provenance, IUPHAR skip and key header.
- Source identity: a rediscovered paper merges into the curated source with the same PMID, snapshots classify as new, unchanged, changed, or newly tracked, and ambiguous identifiers are surfaced without stopping the job.
- Discovery jobs: per-query provenance, search-scope receipts, failed and skipped adapters, and review-task summaries. A job fails only when every attempted source fails.
- Revision carry-forward: every content table copied, every approval and assessment reviewer cleared, the published original untouched, the copy unpublishable until a human re-reviews, and one open draft per peptide.
- Relations: a typed form operation and a database rejection of self-relation.
- A per-request nonce script policy with no `unsafe-inline` or `unsafe-eval` for scripts, no policy violations on visited pages including the 404 page, and hydration confirmed by the analytics beacon.
- ClinicalTrials.gov attribution notice and per-trial retrieval date on published articles.

Automated checks do not establish complete WCAG compliance, scientific correctness, source licensing compliance, or production security.

## Performance diagnostic

`research/lighthouse-local.json` records one Lighthouse run per local homepage in a production build with an empty published library. Women scores were performance 100, accessibility 100, best practices 96, SEO 100. The 50plus scores were 98, 100, 100, and 100. There were no Lighthouse runtime failures. The first page had a missing-icon console error; an application icon was subsequently added.

These are local diagnostics, not a comparative benchmark or production guarantee. The payload uses system fonts, server-rendered content, and CSS illustration. These runs do not measure populated articles, concurrent traffic, hosting latency, production caches, or assistive-technology usability. No speedup or capacity conclusion follows. Re-run against the production host and approved articles before launch. The temporary audit dependency was removed after retaining results.

## Source and scientific validation

Official probes succeeded for PubMed, ClinicalTrials.gov, PubChem, openFDA, RCSB, and UniProt. IUPHAR required a key. A first live application worker run retrieved 10 PubMed, 10 registry, one PubChem, and five FDA discovery matches for semaglutide.

The current adapters were then run live. A read-only run for oxytocin returned PubMed (130 sources from 10 searches, 33,953 reported matches for the bare name, truncated at 60), ClinicalTrials.gov (50 of 935), PubChem (1), openFDA (5 of 9), RCSB (10 of 36), and UniProt (5 of 194, release 2026_03). A full queue-and-worker run for BPC-157 stored 103 new sources and merged one curated source without duplicating it, recorded 22 searches, found 41 sources matched by more than one query, and skipped IUPHAR for lack of a key. No PMID was registered to two sources afterward. The 4 existing BPC-157 claims were unchanged.

All of these are discovery counts, not eligible studies. Observations and review tasks were saved; claims, approvals, and publication counts did not change.

Five dossiers cover semaglutide, CJC-1295, BPC-157, kisspeptin-54, and native MOTS-c. Their exact-source manifest contains 20 references. Four registry records have structured draft snapshots. Full methods, safety denominators, cohort independence, molecular forms, and evidence grades need further review. The dossiers are bounded source samples, not five completed reference-quality publications.

## Acceptance status

| Requirement                             | Current status                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| At least 20 records                     | 22 identities and lifecycle records; 17 unresearched                                            |
| Five reference-quality profiles         | Five sourced dossiers; deeper appraisal and human review pending                                |
| Provenance and evidence separation      | Implemented and checked; no published real-world assertions                                     |
| Regulatory and safety information       | Fields, unknown states, UI, and publication checks implemented; seed assessments remain unknown |
| Search and discovery                    | Published-revision search and taxonomy filters, exercised with fixtures                         |
| Comparison                              | Two through four profiles, exercised with fixtures                                              |
| Citations and trials                    | Interactive references and four private snapshots; production freshness pending                 |
| Editorial workflow                      | Roles, reviews, publication checks, audit, withdrawal, and new revisions                        |
| AI publication restriction              | Database roles, fixed worker identity, human review, and publication checks                     |
| Audience variants                       | Shared science; browser parity checked                                                          |
| Mobile and accessibility                | Sampled responsive and automated checks pass; manual audit pending                              |
| Script policy                           | Per-request nonce, no inline or eval script allowance; verified on the production build         |
| Medical recommendation or dosing system | No such feature exists                                                                          |
| Documentation                           | Architecture, schema, sources, rubric, compliance, research, setup, and quality supplied        |
| Production deployment                   | Not provisioned                                                                                 |

## Work before public launch

Complete five source-text appraisals and human reviews with reproducible search scope. Resolve molecular forms, cohort overlaps, missing counts, safety denominators, and regulatory scope. Add the ClinicalTrials processing date and a terms-compliant current-data display before redistributing registry snapshots. Obtain an IUPHAR key if needed.

Configure HTTPS, production credentials, role provisioning, backups and restore checks, monitored jobs, source-retraction escalation, and current-data notices. Organizational identity lifecycle and account recovery need deployment-specific configuration. Perform keyboard, screen-reader, zoom, and real-device checks on completed articles.

Published identity corrections require a reviewed migration. The AI contract is implemented and tested with a deterministic provider; a live provider is not configured. Discovery is bounded per query, so comprehensive reviews need documented follow-up searches, full-text acquisition, and per-source strategies beyond name matching. The IUPHAR adapter has not run against a live key. Styles still allow inline attributes because React style attributes cannot carry a nonce. Set a PubMed contact email and keys before scheduled use.
