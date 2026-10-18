# Cross-judgment: Candidate A vs Candidate B

I only read the two design docs and changed no files.

## Scores (1–5)

| Criterion              | A   | B   | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provenance integrity   | 4   | 5   | Both keep source identity separate from each retrieval and cite an observation plus a locator. B adds more: approval is tied to a manifest hash, support can be supports, contradicts or context, scope and strength are separate fields, and cell/animal/human evidence can't be merged. A's `EvidenceContext` mixes scope and strength (`human` and `clinical` overlap, and `safety` isn't a context).                     |
| Publication isolation  | 4   | 5   | A has triggers that lock published rows and search that reads published rows only. But A never says which publication is the live one, and has no withdrawal and no rule for an approval going stale. B has an active pointer, withdrawal, search results rechecked against current availability, and closure checks on the sealed manifest.                                                                                 |
| Authorization          | 3   | 4   | A: worker roles can't approve, and the editor's identity comes from verified login. But `actor` is passed inside the command input, there's no revocation, and RLS isn't described. B: RLS, scoped worker roles, `SECURITY DEFINER` with fixed search paths, revocation and publish share one lock, and current authority is checked again at publish. B still lets one admin adopt, approve and publish their own revision. |
| Operational simplicity | 4   | 2   | A is copy-on-revision plus triggers. B has an event ledger, typed event detail tables, a synchronous projection, an outbox, hash canonicalization, expected heads and request keys. That's a lot for an MVP with only a few editors.                                                                                                                                                                                         |
| Queryability           | 4   | 4   | A: rows scoped to a revision are easy to join, but copying means analysis across revisions sees duplicates. B: fully normalized, with a defined search projection, but every read goes through manifest membership tables.                                                                                                                                                                                                   |

## Recommendation

**Base: Candidate B, with its event ledger downgraded.** B itself offers this option: keep immutable revisions, but replace the authoritative ledger with an append-only audit journal written in the same transaction. Keep the manifest hash, the hash-bound approval, the active pointer, withdrawal, expected heads, idempotency keys, per-run proposals and RLS. Drop event replay, projection rebuilds and the outbox. That fixes B's operational simplicity score and removes a dual-authority risk (see hole 1).

**Graft 1 (from A): review at the claim level, tied to content hashes.** A's `reviewClaim` lets an editor approve claim by claim. B requires re-reviewing the whole article after any change. If each approval is keyed to a claim revision's content hash, unchanged claims can be re-confirmed cheaply. The article-level approval of the sealed manifest stays the final gate.

**Graft 2 (from A): more checks in the publish transaction.** Add A's "no unresolved guardrail flags" and "required safety/regulatory coverage" checks to B's closure checks. Run them in the database, not only in TypeScript.

## Holes

1. **B has two sources of truth.** It calls the ledger authoritative but also keeps `review_decision`, `publication` and `active_publication` tables. It never says which one wins if they disagree. Downgrading the ledger resolves this.
2. **The hash canonicalization isn't specified (B).** Field order, Unicode normalization, how locators are encoded, and which fields are scientific vs presentation all decide whether a "matching approved hash" means anything. The spec needs this plus test vectors.
3. **Retractions and corrections don't reach published pages.** B creates a review task and leaves the page up; A doesn't mention it. A retracted or corrected source behind a live safety claim needs an automatic banner, or a policy for pulling the page, within a set deadline.
4. **Separation of duties.** Neither stops one person from authoring and approving. At least require approver ≠ adopter, or flag self-approval visibly.
5. **How drafts are edited is unclear (B).** "Immutable revisions" and "human edits fork from a parent" never say whether a draft can change before sealing. If it can't, every edit becomes a revision and fills the tables with rows.
6. **A is underspecified on:**
   - concurrency (no expected head, no idempotency)
   - which publication is active
   - withdrawal
   - identity merges and slug redirects
   - where reviewed plain-language text lives for each audience ("presentation profile" doesn't say)
   - worker isolation: workers write draft claims straight into the editor's revision, so two runs, or a run and an editor, can collide
7. **Prompt injection is covered only in B, and only in one sentence.** Neither says how text extracted from sources is kept separate before an editor reads it.
8. **Admin escape hatch.** B's "audited migration credentials" can rewrite immutable rows. It needs a defined process and alerting. A's triggers have the same bypass and don't mention it.
9. **Licensing.** Both defer what can be retained and redistributed, but A stores "permitted source excerpts" without defining who decides what's permitted.
10. **No adversarial test plan beyond one sentence.** Both name the same next step. The minimum test matrix: stale tab, revoked approval racing publish, worker role trying to publish, a duplicate lease, and a child-row update after sealing.

**Bottom line:** B's correctness model with A's operating cost. B's own authors say their scientific design works with either the ledger or an audit journal. Pick the journal.
