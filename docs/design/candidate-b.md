# Candidate B: Immutable scientific revisions and an editorial event ledger

## Problem

Scientific drafts will change while workers discover papers, editors reject claims, and readers continue seeing an earlier approved page. A mutable peptide row with a publication flag cannot say exactly which wording, evidence, jurisdictional status, or citations a human approved. This candidate makes scientific revisions immutable, records editorial decisions as events, and publishes a sealed manifest of normalized revision references. PostgreSQL/Supabase owns the scientific records; Next.js renders the same published document through two presentation systems. This is a documentation sketch for greenfield Phase 0, not application implementation or a claim that source integrations have already been validated.

## Usage (caller's view)

The caller requests a complete domain operation. It never sequences claim validation, reviewer authorization, source locking, snapshot assembly, and public indexing itself.

```ts
// Research API: authenticated researcher submits a seed; retries reuse a request key.
import { research } from "@peppy/research";
const run = await research.request({
  canonicalName: "BPC-157", aliases: ["BPC157"], identifiers: [],
  requestKey: request.idempotencyKey,
}, researcher);
// { runId, state: "queued" }; a worker writes isolated proposals for this run.

// Admin: adopt a proposal, review the sealed revision, then publish that exact revision.
import { editorial } from "@peppy/editorial";
const draft = await editorial.adopt({ proposalId, expectedHead, requestKey }, researcher);
const review = await editorial.review({
  revisionId: draft.revisionId, decision: "approve", reason,
  expectedHead: draft.head, requestKey: reviewRequestKey,
}, editor);
const publication = await editorial.publish({
  revisionId: draft.revisionId, approvalId: review.approvalId,
  expectedHead: review.head, requestKey: publishRequestKey,
}, editor);
// Concurrent draft edits return a conflict; a new revision needs its own review.

// Both Next.js audience routes use the same document, citation IDs, and safety facts.
import { library } from "@peppy/library";
const document = await library.articleBySlug(slug);
return <Article document={document} presentation={audiencePresentation} />;
// Presentation controls typography, layout, and discovery emphasis. Explanatory text
// comes from reviewed technical/plain-language fields in this same document.
```

## Shape

### Core data structures and signatures

The following TypeScript is a design notation inside documentation, not a new source file. IDs denote opaque, constructor-controlled domain values; `Actor` comes from server authentication and current role lookup, never from a client role claim. `RevisionId`, `ApprovalId`, and `SourceVersionId` are distinct nominal types in implementation.

```ts
type EvidenceKind =
  | "in_vitro"
  | "animal"
  | "case_report"
  | "observational"
  | "pilot_human"
  | "clinical_trial"
  | "randomized_controlled_trial"
  | "systematic_review"
  | "meta_analysis"
  | "regulatory"
  | "unknown";
type Knowledge<T> =
  | { state: "established"; value: T }
  | {
      state: "unknown" | "insufficient" | "conflicting" | "not_established";
      explanation: string;
    };
type Support = {
  evidenceRevisionId: EvidenceRevisionId;
  sourceVersionId: SourceVersionId;
  locator: SourceLocator; // abstract field, section, page, table, or registry field
  relation: "supports" | "contradicts" | "context";
};
type ClaimRevision = {
  id: ClaimRevisionId;
  peptideId: PeptideId;
  technicalText: string;
  plainText: string;
  assertionScope: "cell" | "animal" | "human" | "mixed" | "regulatory";
  kind: ClaimKind;
  support: readonly [Support, ...Support[]];
  uncertainty: Knowledge<ScientificConclusion>;
};
type ArticleRevision = {
  id: RevisionId;
  peptideId: PeptideId;
  parent: RevisionId | null;
  claims: readonly ClaimRevisionId[];
  structure: readonly SectionBlock[]; // factual blocks reference claims, never free text
  grades: readonly GradeAssessmentId[];
  safety: readonly SafetyRevisionId[];
  regulations: readonly RegulatoryRevisionId[];
  trials: readonly TrialRevisionId[];
  identity: IdentityRevisionId;
  manifestHash: ManifestHash;
  rubricVersion: RubricVersion;
};
type EditorialHead = { peptideId: PeptideId; sequence: StreamSequence };
type Reviewed = { approvalId: ApprovalId; head: EditorialHead };
type Publication = { publicationId: PublicationId; revisionId: RevisionId };
type PublishedArticle = {
  publicationId: PublicationId;
  contentHash: ManifestHash;
  identity: PublishedIdentity;
  sections: readonly PublishedSection[];
  grades: readonly PublishedGrade[];
  safety: readonly PublishedSafety[];
  regulations: readonly PublishedRegulation[];
  trials: readonly PublishedTrial[];
  references: readonly PublishedReference[];
  reviewedAt: Instant;
};

interface Research {
  request(
    seed: ResearchSeed & { requestKey: RequestKey },
    actor: Actor,
  ): Promise<ResearchRun>;
  inspect(runId: RunId, actor: Actor): Promise<ResearchRunDetail>;
}
interface Editorial {
  adopt(
    input: AdoptProposal,
    actor: Actor,
  ): Promise<{ revisionId: RevisionId; head: EditorialHead }>;
  revise(
    input: ReviseArticle,
    actor: Actor,
  ): Promise<{ revisionId: RevisionId; head: EditorialHead }>;
  review(input: ReviewRevision, actor: Actor): Promise<Reviewed>;
  publish(input: PublishRevision, actor: Actor): Promise<Publication>;
  withdraw(input: WithdrawPublication, actor: Actor): Promise<void>;
  history(
    peptideId: PeptideId,
    actor: Actor,
  ): Promise<readonly EditorialChange[]>;
}
interface Library {
  articleBySlug(slug: string): Promise<PublishedArticle | null>;
  discover(query: DiscoveryQuery): Promise<PublishedSearchPage>;
  compare(peptides: TwoToFourPeptideIds): Promise<PublishedComparison>;
}
```

Command input types correspond to the usage above and include request keys and expected heads for state-changing editorial commands. Untrusted strings, identifiers, and query parameters are parsed at the API boundary. Typed domain failures distinguish authorization, stale head, inadequate provenance, invalid transitions, and retryable transport failures. A successful `review` with rejection returns a discriminated rejected result rather than the `Reviewed` approval shape; the approval usage is narrowed by its `decision: "approve"` overload. Implementation should make that distinction explicit rather than returning an optional approval ID.

`SectionBlock` has only curated heading/glossary blocks and scientific claim references, with approved technical/plain-language forms. Scientific statements in metadata, mechanism descriptions, timelines, research-area associations, relationships, and summaries also require claim links. “Unknown long-term safety” is an explicit reviewed gap assertion with a search scope and date, not an invented negative finding. A source link alone never proves efficacy.

### Ownership and module map

| Module      | State it alone writes                                                                                        | Complexity hidden                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `identity`  | peptide identities, identifiers, aliases, merge decisions                                                    | normalized identifiers, ambiguity resolution, collision reporting; never auto-merges by similar name             |
| `sources`   | source identities, immutable retrieval versions, acquisition receipts                                        | upstream identifiers, duplicate detection, payload hashes, licensing metadata, source corrections                |
| `research`  | run requests, job leases, per-run proposals                                                                  | adapter contracts, bounded retries, extraction validation, provider-neutral structured AI output                 |
| `editorial` | immutable scientific revisions, review decisions, editorial events, publication manifests and active pointer | claim provenance, revision closure, evidence scope, human approval, concurrent commands, publication transaction |
| `library`   | disposable publication-derived search index                                                                  | active-publication reads, citation numbering, evidence browse, comparison projection                             |
| `web`       | presentation preferences only                                                                                | two accessible visual systems, thin authenticated API adapters, public rendering                                 |

Exports expose these interfaces only; package exports and import rules block direct repository/database imports from web or other modules. Within an operation, transport calls its owning module and then its repository; there is no generic validate/transform/save service chain. This keeps interface depth high per boundary-discipline and minimize-reader-load: a publish command hides all policy and transaction work behind one request.

Scientific revision ownership belongs wholly to editorial. Workers never mutate claims another researcher is reviewing: each run emits its own proposed facts and source references. Adopting a proposal creates a new article revision; it does not patch the current published page. Human edits fork from a declared parent, and a stale parent is returned to the researcher for a deliberate merge. Per separate-before-serializing-shared-state, only the genuinely shared editorial head and active publication pointer need serialized writes.

### Event authority and publication transaction

This candidate uses event sourcing for editorial decisions, not for downloaded abstracts or every database field. An append-only per-peptide ledger records revision adoption, revision creation, review approval/rejection, approval revocation, publication activation, withdrawal, archive, and identity merge references. Typed event detail tables reference normalized immutable scientific revisions; event payloads do not become a JSON substitute for the knowledge schema.

The ledger is authoritative for editorial history and current workflow projection. A command locks the stream head, validates expected sequence and current authority, inserts immutable rows plus an event, updates the synchronous workflow projection, and commits once. An asynchronously rebuilt projection is never used to authorize publication. Each event records actor, server time, reason, command key, and schema version. The lifecycle projection supports all required statuses; published availability and a new draft's research status are separate dimensions so revising a live peptide does not accidentally hide it. The UI can show “Published · update needs review.”

Publication seals a normalized manifest that references immutable identity, source, evidence, claim, grade, safety, regulatory, trial, taxonomy-label, and relationship revisions. It checks manifest closure, exact matching approved content hash, current nonrevoked human approval, and complete required sections within one transaction before inserting a publication event and switching the active pointer. All scientific edits create another revision and therefore cannot inherit an old approval. Repeating a command key with the same body returns the original result; a different body is rejected.

The source and evidence rows a snapshot uses cannot change. New registry status, a corrected paper, or a revised taxonomy label creates another version and a review task. Existing public pages retain their dated assertions until reviewed or explicitly withdrawn. A separately reviewed urgent warning may be published as an immutable notice linked to affected publications; it must not silently rewrite their historical text. Withdrawal clears the public pointer and visibility immediately; search may lag but every result is checked against current availability. Public history endpoints must also check withdrawal policy.

### Dominant access paths

- Read: slug resolves identity/redirect, active pointer resolves one publication, indexed manifest joins expand immutable rows. Both audiences receive the same scientific payload and citation mapping. Public readers cannot query draft tables.
- Search/browse: one Postgres full-text/trigram projection per active publication includes normalized names, aliases, research codes, targets, mechanism terms, taxonomy memberships, and grade axes. Canonical slug and publication ID are stored alongside it. Alias punctuation normalization supports BPC157/BPC-157 without claiming unrelated identities are equivalent. Join active pointers before returning results.
- Review: revision manifest expands claims with supporting/contradicting evidence and source versions; filters isolate human, animal, and cell evidence. A review records rubric version, each required grade rationale, provenance checks, and reviewer identity against the content hash.
- Compare: obtain active publication IDs in one consistent database snapshot and fetch 2–4 immutable manifests. Show each review date and grade axis, without collapsing dimensions into a treatment ranking.
- Re-ingest: unique run/request key and per-source acquisition identity prevent duplicate proposals after lease expiry. External API requests may occur twice; committed observations, normalized sources, and command effects converge through uniqueness constraints.

### Migration and constraint sketch

Create actual SQL migrations after synthesis; this lists the load-bearing constraints rather than claiming a complete executable schema.

1. Identity: `peptide`, `peptide_identifier(namespace, normalized_value)`, `peptide_alias`, `identity_revision`, `identity_merge`. Global unique external identifiers; unique normalized alias per peptide, not globally, because aliases can be ambiguous. Slugs are globally unique; redirects preserve merged/renamed pages.
2. Provenance: `source`, `source_identifier`, `source_version`, `retrieval_receipt`; unique normalized DOI/PMID/registry IDs by namespace, with explicit conflict records when identifiers disagree. Retrieval receipts retain retrieval time, connector/query version, permitted raw-payload location/hash and acquisition status. Source versions retain citation metadata, licensed excerpts/locators and licensing/attribution requirements; restricted full texts need not be copied into public storage.
3. Science: immutable `evidence_revision`, `claim_revision`, `claim_support`, `mechanism_revision`, `trial_revision`, `safety_revision`, `regulatory_revision`, `grade_assessment`, `research_area_revision`, and `relationship_revision`; normalized many-to-many link tables replace `source_ids[]`. Separate study design, species/population, and evidence type. Trial identity unique on `(registry, registry_id)`; a trial can associate with several peptides. Regulatory assertions include jurisdiction, indication/formulation scope, as-of date and source support, not a global approval boolean.
4. Article: `article_revision`, `article_section_block`, and typed manifest membership tables; composite `(peptide_id, revision_id)` foreign keys forbid mixing different peptides. Row-level checks enforce counts/nonnegative sample sizes, grade/uncertainty vocabularies and locator shape. Grade records require a rubric version and cited evidence set. Source-support membership and nonempty citation sets require a deferred constraint trigger or sealed-revision transaction; a row `CHECK` cannot enforce child-row existence.
5. Editorial: `editorial_event(peptide_id, sequence, kind, actor_id, command_id, schema_version)`, typed event detail tables, `editorial_head`, `review_decision`, `approval_revocation`, `publication`, typed publication membership tables, `active_publication`, `outbox`. Unique `(peptide_id, sequence)` and command key; publication has a composite FK matching the reviewed `(revision_id, manifest_hash)`. Approvals reference an authenticated human actor and immutable revision. Review revocation and publish share the stream lock so races cannot publish a revoked approval.
6. Permissions: RLS denies anonymous access to research/editorial tables. Public views resolve active publications only. Workers use narrowly scoped DB roles that can write proposals/source versions but cannot approve, create publications, or mutate public pointers. Researchers cannot approve/publish; editors/admins can invoke guarded publication operations. `SECURITY DEFINER` operations have fixed search paths and validate the authenticated role internally. No browser service-role secret. Immutable table update/delete privileges are revoked and protected by triggers; audited migration credentials remain the explicit administrative escape hatch.

Snapshot closure is frozen by construction: all referenced versions and membership links are insert-only, and a sealed manifest rejects further inserts. A hash is computed from canonicalized, ordered scientific values and revision references, not mutable row timestamps. The database owns the actual review gate even if a future API caller ignores TypeScript types.

### Critical safety invariants

- A worker or LLM can create proposals only. “AI summary” is never a scientific source, and external source text is treated as data rather than instructions to the worker.
- Every substantive visible scientific assertion resolves to its exact reviewed claim revision, source version, evidence classification and locator. Claim-to-source existence is necessary but human review must still establish that the source supports the wording.
- Cell, animal, observational human, controlled human, and regulatory evidence remain distinct. Evidence strength and assertion scope are separate fields. Human efficacy claims cannot be approved from animal evidence alone; systematic reviews inherit the scopes of included evidence rather than automatically becoming human evidence.
- Five grade axes remain separate: preclinical, human, clinical, safety, and regulatory maturity. No inferred “safe” conclusion from missing adverse-event reports; no numeric overall peptide ranking.
- Approval is a human decision about one sealed manifest and rubric version. Any changed fact, summary, audience-specific explanation, citation, grade, or safety text needs another approval.
- Publication is atomic and fail-closed. A lease crash, duplicate job, stale editor tab, or delayed search update cannot expose an unapproved revision.
- Both presentations include the same safety/unknowns and scientific scope markers. Presentation may shorten initial display only with access to the reviewed full text and without hiding qualifications that change the meaning.

## Synthesis decision

Independent candidate B; the orchestrator records the final base and grafts after comparison. Its defining proposal is immutable normalized revisions plus an authoritative editorial event ledger, with synchronous publication authorization.

## Tradeoffs accepted

- We accept more revision and membership rows in exchange for exact citation and approval history without copying whole pages into opaque JSON.
- We accept a per-peptide serial command head in exchange for atomic editorial decisions; concurrent ingestion stays isolated by run.
- We accept typed event migrations and projection rebuild maintenance in exchange for reconstructable editorial history. Scientific data itself remains relational and queryable without replay.
- We accept explicit human merge work when concurrent drafts conflict in exchange for avoiding an automatic merge that invalidates a scientific review.
- We accept dated publications retaining superseded source states in exchange for reproducible editorial records, with review tasks, explicit notices and withdrawal as correction mechanisms.

## Alternatives considered

- Mutable peptide aggregate with normalized current child rows, an audit table, and copied publication snapshots: substantially simpler operations and a deep publish interface are possible. It loses here because audit and current tables can disagree unless every writer shares one enforced transaction path; revisions also need separate frozen review targets. This remains a strong MVP base if full event authority is judged unnecessary.
- Full event sourcing for all scientific facts and retrievals: hides persistence but makes every scientific query depend on projection correctness, replay migrations and upstream schema translations. It exposes freshness/version concerns to readers and reviewers, so the extra event breadth does not improve the caller interface.
- Markdown articles with citation tokens and two AI-generated audience summaries: low initial schema cost, but the publish caller must inspect opaque text for unsupported claims and divergent summaries. It cannot enforce the same scientific invariants through a smaller interface.

## Open questions and risks

- Would a single human editor provide the intended scientific review quality, or should publication require independent reviewers for higher-risk claim categories? The MVP permission model allows one authorized human; a two-person policy would be a deliberate later rule.
- Should withdrawn historical content remain accessible to authenticated editors only, or also publicly with an unmistakable withdrawal notice? Default public reads exclude it.
- Can the team justify event schema and replay maintenance for the expected editor count, or should synthesis retain immutable revisions with a transactionally appended audit journal instead? The scientific snapshot and review design works with either decision.
- Which acquired payloads permit retention and redistribution? Final adapter and storage contracts depend on the separate authoritative-source investigation.

## Next implementation step

After architecture synthesis, write the normalized migration for one scientific revision, its source support, review decision, and atomic publication transaction, then validate draft isolation and revoked/stale approval rejection against PostgreSQL before frontend work.
