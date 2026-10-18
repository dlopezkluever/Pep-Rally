# Design synthesis

## Decision

Use candidate B's immutable revision and active-publication model with candidate A's relational draft editing and claim review. Replace the event sourced ledger with an append-only audit journal in the same transaction. Public reads resolve the active publication and never a draft. Approved scientific rows are frozen by database triggers.

## Comparison

Both candidates were read in full. The independent Claude review is in `cross-judge.md`; its recommendation is B with a journal replacing event sourcing. The parent review agrees.

| Criterion, maximum 5   | A   | B   | Synthesized |
| ---------------------- | --- | --- | ----------- |
| Provenance integrity   | 4   | 5   | 5           |
| Publication isolation  | 4   | 5   | 5           |
| Authorization          | 3   | 4   | 4           |
| Operational simplicity | 4   | 2   | 4           |
| Queryability           | 4   | 4   | 4           |

These are design judgments, not measured product quality scores. The configured Claude family was unavailable through native agent dispatch, but the installed Claude CLI worked. Independent GPT and Claude designs and a Claude cross review were completed.

## Grafts and rejected complexity

Keep B's observation-level provenance, support/contradiction distinction, exact revision scope, active publication pointer, and row-level permissions. Keep A's per-claim reviews, transactional required-section checks, and direct revision joins. Freeze the entire reviewed revision rather than introducing a separate manifest hash that duplicates relational membership. Published revisions cannot accept child inserts, updates, or deletes. Draft claims can change, but wording or citation changes invalidate their review. A new publication requires a new revision.

Do not implement event replay, projection reconstruction, or three-way fact merges for the first corpus. Each research run owns its draft revision. Concurrent editors use expected update timestamps, and database locks serialize changes with publication. Withdrawing a publication removes its active pointer and appends an audit event.

## Review findings carried forward

Authentication must supply actor identity server-side. Researchers cannot set review fields, and neither workers nor AI can impersonate an editor. Review and publish recheck current role and disabled status. Every public scientific block is claim-backed. Dated source corrections create review tasks; an editor can immediately withdraw a page. The product requires a documented operational escalation policy before production deployment.

Separation of author and approver is desirable but not mandated by the PRD. The MVP permits an authenticated human editor to approve their own authored draft, records that identity, and never treats agent activity as human review. A future organization can require two independent editors without changing scientific storage.

## Validation

The schema is executable, with real PostgreSQL checks for citation integrity, child-row immutability, human-only review, missing required dimensions, and publication rollback. Results are recorded in the quality report after execution. No claim of production readiness follows from design review alone.
