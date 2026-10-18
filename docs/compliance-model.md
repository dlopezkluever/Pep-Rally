# Editorial and regulatory boundaries

## Trust boundary

Source text, machine extraction, AI interpretation, and editor-approved claims have distinct records. A source discovery is not an approved citation. Human review must inspect the cited passage and its applicability. No seed data or AI output receives an editor identity automatically.

An authenticated researcher can create drafts and attach observations. An editor or admin can review claims and publish. A viewer cannot mutate research. Database roles and server authorization both enforce these restrictions. Service credentials remain server-side. Production needs an identity provider or configured password credentials, HTTPS, and secure cookies.

## Publication contract

Publication operates on an immutable revision. All visible scientific assertions, including summaries, mechanisms, safety findings, timelines, research-area relationships, and regulatory statements, must cite source observations and have an approved claim. Claims include context, confidence, outcome scope, limitations, retrieval date, and reviewer.

Publishing requires at least one approved claim, no unreviewed or rejected visible claim, five evidence assessments, explicit safety unknowns, a US regulatory record, completed source review, and resolution of unsupported-language flags. These conditions are necessary editorial checks. They do not prove scientific correctness. Claims based on abstracts must disclose that scope.

Changes to a reviewed draft invalidate its approval. Published content cannot be edited. A new revision receives new claim reviews. Published revisions reference immutable source observations; source corrections trigger review tasks and replacement revisions.

## Language checks

Flag `treats`, `cures`, `prevents`, `reverses`, `guarantees`, `heals`, `boosts`, `burns fat`, `builds muscle`, `anti-aging`, and `extends lifespan`. A flag requires a human rationale and supporting source, even where a legitimate approved indication supports the wording. These checks also cover animal-to-human, mechanism-to-clinical-effect, association-to-causation, and pilot-to-established-efficacy overstatements.

The wording detector is a screening aid. It cannot infer scientific support. Unsupported claims remain drafts. Human benefit claims require human evidence for the actual outcome and context. Regulatory claims require authoritative regulatory sources.

## Reader disclosures

Every article shows its last human review date, source count, known included human study count, registry count, five evidence dimensions, and jurisdiction-specific regulatory status. Counts describe the reviewed included set, not all research in existence. Educational content does not replace professional care. Inclusion does not establish efficacy. Animal findings may not translate to humans.

Unknown safety is explicit. Commercial and scientific identities remain separate. The MVP has no dosing, purchasing, diagnosis, personalized health advice, or medical-history collection.

## Privacy and operations

Analytics record only event category, audience, optional public peptide ID, and aggregate counts. Do not retain raw searches, IP addresses, health profiles, or free-text personal data. Rate limits may use short-lived keyed IP hashes. Audit events record actor, action, entity, timestamp, reason, and revision. Passwords use a salted adaptive hash. Sessions use random tokens stored only as hashes with expiry.

Source permissions are recorded per observation. Store metadata and allowed excerpts. Public abstracts are not automatically licensed for republication. Do not redistribute IUPHAR data until its attribution and share-alike implications are addressed. API failure, blocked access, or no search results become explicit retrieval states rather than scientific conclusions.
