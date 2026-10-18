# Normalized data model

The executable schema is `db/migrations/001_foundation.sql`. All scientific content belongs to a revision. Names and identifiers resolve stable peptide identities; evidence and claims never attach to audience-specific pages.

## Entities

| Table                                    | Purpose and relationships                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| peptide                                  | Stable slug and canonical identity                                                                                |
| peptide_identifier                       | Unique namespace/value identity mapping                                                                           |
| peptide_alias                            | Scientific, commercial, code, abbreviation, and legacy aliases; ambiguity across compounds is allowed             |
| revision                                 | Peptide-scoped draft or frozen publication with parent, research and review dates                                 |
| peptide_profile                          | Revision-scoped chemistry and development fields; null means not established in this revision                     |
| taxonomy, revision_taxonomy              | Configurable area and family terms; published association has a reviewed claim and label snapshot                 |
| source, source_identifier                | Deduplicated source identity, including normalized DOI, PMID, and registry identifiers                            |
| source_observation                       | Immutable metadata and permitted text snapshot, URL, retrieval date, scope, hash, and rights                      |
| study, study_source                      | Distinct research cohorts or experiments, separate from papers and registry records                               |
| evidence_record                          | Revision evidence linked to study, observation, and claim with design, finding, limitations, and confidence       |
| claim, claim_citation                    | Scientific text, context, uncertainty, human review, and exact supporting observation/locator                     |
| mechanism                                | Target/pathway classification linked to reviewed scientific claim                                                 |
| clinical_trial, trial_record             | Unique registry identity and revision-scoped status, enrollment, outcomes, dates, result availability             |
| safety_record                            | Category, observed/theoretical/unknown state, severity and evidence context linked to claim                       |
| regulatory_record                        | Jurisdiction, agency, product/indication/formulation/route/population scope and verification date linked to claim |
| evidence_assessment, assessment_evidence | Five separate dimensions with rubric version, search scope, rationale, reviewer, and included evidence            |
| peptide_relation                         | Typed relation to another identity, with reviewed claim                                                           |
| claim_flag                               | Unsupported wording or inference warning and human resolution                                                     |
| publication, active_publication          | Frozen historical publication and current public pointer                                                          |
| actor, session                           | Human identity, role, password hash and expiring hashed session tokens                                            |
| audit_event                              | Immutable action, actor, reason, time, and structured details                                                     |
| research_job, discovery, extraction      | Idempotent queued acquisition, observations, and explicitly separate AI interpretation                            |
| review_task                              | New evidence and refresh work for humans                                                                          |
| rate_bucket, analytics_daily             | Short-lived request limits and anonymous daily event totals                                                       |

## Referential integrity

Scientific extension tables use composite `(claim_id, revision_id)` foreign keys to prevent accidental cross-revision claims. Citations require observation IDs and locators. Citation relations distinguish support, contradiction, and context. Source identity is separate from immutable retrieval versions. PMID, normalized DOI, and NCT identifiers are unique within namespace.

Database triggers freeze approved, published, and archived revision content. Citation changes invalidate claim review. Wording changes invalidate approval and regenerate language flags. Publishing locks the same revision that content writes lock. A new revision receives fresh reviews.

## Publication query

Public data starts at `active_publication`, joins `publication`, then uses only its revision. Public readers never select the latest draft. Evidence and trial counts derive from distinct included studies and registry identities. A revision cannot be published until every included claim is approved and cited, five dimensions reviewed, US regulatory status and safety records supplied, and unknowns stated.

## Unknowns and regulation

`knowledge_state` distinguishes known, unknown, insufficient evidence, conflicting evidence, and not established. A grade remains null until assessed. None Identified requires a completed search date. Regulatory maturity uses jurisdiction-specific status rather than a Strong/Moderate grade. A compounding decision never substitutes for drug approval.

## Migration policy

Number migrations in execution order. Record applied file hashes and reject changes to already applied migrations. New source responses create observations rather than editing old metadata. Source corrections and trial changes create review tasks. Local seed records remain drafts.
