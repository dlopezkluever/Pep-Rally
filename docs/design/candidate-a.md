# Candidate A: relational revisions with explicit publication

## Problem

Researchers change evidence while readers need stable, reviewed articles. Evidence and references need relational constraints. Audience themes must render exactly the same science.

## Usage

```typescript
const revision = await editorial.beginRevision({ peptideId, actor });
await research.discover({ revisionId: revision.id, canonicalName, aliases });
await editorial.reviewClaim({ claimId, decision: "approve", actor, reason });
const publication = await editorial.publish({ revisionId: revision.id, actor });
const article = await catalog.getPublished({ slug });
```

## Shape

Postgres owns identifiers, normalized revision content, source observations, claims, citations, evidence assessments, authorization, and publication transactions. Each peptide has a stable identity and many revisions. Child scientific rows belong to exactly one revision. A publication points to a locked approved revision. Search reads published revisions only.

The research worker can add source observations and draft claims, but its database role cannot approve or publish. Human editor identity comes from verified authentication. Publishing is a single transaction that checks role, revision state, approved claims, citations, safety and regulatory coverage, completed evidence assessments, unresolved guardrail flags, and freshness of approvals. The transaction locks the revision. Published rows cannot be changed, including through child tables.

Source identity is separate from retrieval. A paper has one PMID and DOI where known, while repeated retrievals retain timestamps, hashes, retrieval status, and permitted source excerpts. Claim citations reference a specific source observation and locator. A source record alone does not prove the claim.

```typescript
type ReviewDecision = "approve" | "reject";
type Audience = "women" | "50plus";
type EvidenceContext = "cell" | "animal" | "human" | "clinical" | "safety";
interface Catalog {
  getPublished(input: { slug: string }): Promise<PublishedArticle | null>;
  search(input: SearchInput): Promise<PublishedSearchResult[]>;
}
interface Editorial {
  beginRevision(input: BeginRevision): Promise<DraftRevision>;
  reviewClaim(input: ClaimReview): Promise<void>;
  publish(input: PublishRevision): Promise<Publication>;
}
interface Research {
  discover(input: ResearchSeed): Promise<ResearchJob>;
}
```

These are design signatures, not implemented interfaces. Storage types stay behind catalog, editorial, and research modules. Rendering receives one validated article object and a presentation profile.

## Tradeoffs accepted

We accept copying normalized content into a new revision in exchange for historical consistency and simple publication reads. We accept database triggers in exchange for preventing a forgotten API guard from changing reviewed science.

## Alternatives considered

An event sourced system stores every fact change as an event and builds reader projections. It offers reconstruction but adds projection lag, replay logic, and event schema migration before the MVP needs them. Mutable canonical rows with an audit log are simpler to write, but a public join can accidentally include an unreviewed change.

## Open risks

Scientific review cannot be supplied by software. Approval is an authenticated human action. Exact compound, formulation, route, population, indication, and jurisdiction must qualify regulatory and evidence statements.

## Next implementation step

Create the normalized schema and execute adversarial publication checks against a real Postgres database.
