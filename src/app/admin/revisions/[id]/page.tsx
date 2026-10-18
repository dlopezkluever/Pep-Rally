import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/lib/auth";
import { previewArticle } from "@/lib/catalog";
import { queue, sources } from "@/lib/editorial";
import { ArticleView } from "@/components/article";
import {
  gradeSchema,
  knowledgeSchema,
  sectionSchema,
  evidenceType,
} from "@/lib/domain";
import { z } from "zod";
import { ResearchRecordForm } from "@/components/research-record-form";
export const metadata: Metadata = {
  title: "Draft review",
  robots: { index: false, follow: false },
};
function Op({
  operation,
  id,
  revisionId,
  children,
}: {
  operation: string;
  id?: string;
  revisionId?: string;
  children: React.ReactNode;
}) {
  return (
    <form action="/api/editorial" method="post" className="stack">
      <input type="hidden" name="operation" value={operation} />
      {id && <input type="hidden" name="id" value={id} />}
      {revisionId && (
        <input type="hidden" name="revisionId" value={revisionId} />
      )}
      {children}
    </form>
  );
}
export default async function Revision({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const [article, observations, peptides] = await Promise.all([
    previewArticle(parsed.data, actor.id),
    sources(actor),
    queue(actor),
  ]);
  if (!article) notFound();
  const editable = !["approved", "published", "archived"].includes(
    article.status,
  );
  const editor = ["editor", "admin"].includes(actor.role);
  const claims = (
    <select name="claimId" required>
      <option value="">Choose a claim in this revision</option>
      {article.claims.map((c) => (
        <option key={c.id} value={c.id}>
          {c.section}: {c.claim_text.slice(0, 100)}
        </option>
      ))}
    </select>
  );
  const observationSelect = (
    <select name="observationId" required>
      <option value="">Choose a source observation</option>
      {observations.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title.slice(0, 120)}
        </option>
      ))}
    </select>
  );
  return (
    <main className="admin-wrap">
      <Link href="/admin">← Research queue</Link>
      <div className="admin-review-heading">
        <div>
          <p className="eyebrow">
            Revision / {article.status.replaceAll("_", " ")}
          </p>
          <h1>{article.name}</h1>
        </div>
        <Link href="#draft-preview">Read draft preview ↓</Link>
      </div>
      <div className="review-columns">
        <div>
          <section className="panel">
            <h2>Claim review</h2>
            <p>
              Check the original passage, scope, identity, limitations, and
              wording before approving.
            </p>
            {article.claims.map((c) => (
              <article className="review-claim" key={c.id}>
                <span className="badge">
                  {c.section} · {c.evidence_type.replaceAll("_", " ")}
                </span>
                <p>{c.claim_text}</p>
                <p className="small">Limits: {c.limitations}</p>
                {c.citations.map((s) => (
                  <p key={`${s.id}-${s.locator}`} className="small">
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title} ↗
                    </a>
                    <br />
                    {s.scope} · {s.locator}
                  </p>
                ))}
                <p>
                  {c.approved
                    ? "Approved by a human editor"
                    : "Awaiting human approval"}
                </p>
                {editor && editable && (
                  <Op operation="review" id={c.id}>
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={article.updatedAt}
                    />
                    <label>
                      Review rationale
                      <textarea name="reason" minLength={10} required />
                    </label>
                    <label>
                      Decision
                      <select name="decision">
                        <option value="approve">
                          Approve this exact claim
                        </option>
                        <option value="reject">
                          Reject / return for revision
                        </option>
                      </select>
                    </label>
                    <button>Record human review</button>
                  </Op>
                )}
              </article>
            ))}
          </section>
          {editable && (
            <section className="panel">
              <h2>Add a sourced claim</h2>
              <Op operation="claim" revisionId={article.revisionId}>
                <input
                  type="hidden"
                  name="expectedUpdatedAt"
                  value={article.updatedAt}
                />
                <label>
                  Section
                  <select name="section">
                    {sectionSchema.options.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Scientific claim
                  <textarea
                    name="text"
                    minLength={10}
                    maxLength={6000}
                    required
                  />
                </label>
                <label>
                  Plain-English explanation
                  <textarea name="plainText" maxLength={6000} />
                </label>
                <label>
                  Claim context
                  <select name="scope">
                    {[
                      "unknown",
                      "cell",
                      "animal",
                      "human",
                      "clinical",
                      "regulatory",
                      "mixed",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Evidence type
                  <select name="evidenceType">
                    {evidenceType.options.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>Supporting source{observationSelect}</label>
                <label>
                  Exact source locator
                  <input
                    name="locator"
                    minLength={3}
                    placeholder="Abstract, results paragraph; label section 5.1…"
                    required
                  />
                </label>
                <label>
                  Limitations
                  <textarea name="limitations" minLength={5} required />
                </label>
                <button>Save as unreviewed claim</button>
              </Op>
            </section>
          )}
        </div>
        <aside>
          {article.flags.length > 0 && (
            <section className="panel">
              <h2>Claim flags</h2>
              {article.flags.map((f) => (
                <div key={f.id} className="review-claim">
                  <p>
                    {f.code}: {f.detail}
                  </p>
                  {f.resolved_by ? (
                    <p>Resolved: {f.resolution}</p>
                  ) : editor && editable ? (
                    <Op operation="resolve_flag" id={f.id}>
                      <label>
                        Why the source supports this wording
                        <textarea name="reason" minLength={10} required />
                      </label>
                      <button className="outline">Resolve flag</button>
                    </Op>
                  ) : (
                    <p>Unresolved</p>
                  )}
                </div>
              ))}
            </section>
          )}
          {editor && editable && (
            <section className="panel">
              <h2>Evidence assessments</h2>
              <p>
                Use the documented rubric. Unknown dimensions receive no grade.
              </p>
              {["preclinical", "human", "clinical", "safety", "regulatory"].map(
                (d) => {
                  const a = article.assessments.find((x) => x.dimension === d);
                  return (
                    <details key={d}>
                      <summary>
                        {d}: {a?.grade ?? a?.state ?? "Unassessed"}
                      </summary>
                      <Op
                        operation="assessment"
                        revisionId={article.revisionId}
                      >
                        <input type="hidden" name="dimension" value={d} />
                        <label>
                          Knowledge state
                          <select
                            name="state"
                            defaultValue={a?.state ?? "unknown"}
                          >
                            {knowledgeSchema.options.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Grade
                          <select name="grade" defaultValue={a?.grade ?? ""}>
                            <option value="">
                              No grade / regulatory status separately
                            </option>
                            {gradeSchema.options.map((g) => (
                              <option key={g}>{g}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Assessment rationale
                          <textarea
                            name="rationale"
                            minLength={20}
                            defaultValue={a?.rationale}
                            required
                          />
                        </label>
                        <label>
                          Search scope
                          <textarea
                            name="searchScope"
                            minLength={10}
                            defaultValue={a?.search_scope}
                            required
                          />
                        </label>
                        <label>
                          Completed search date, if applicable
                          <input name="searchDate" type="date" />
                        </label>
                        <button>Record human assessment</button>
                      </Op>
                    </details>
                  );
                },
              )}
            </section>
          )}
          {editable && (
            <>
              <section className="panel">
                <h2>Safety record</h2>
                <Op operation="safety" revisionId={article.revisionId}>
                  <label>Supporting reviewed claim{claims}</label>
                  <label>
                    Category
                    <select name="category">
                      {[
                        "unknown_long_term_risk",
                        "adverse_event",
                        "toxicity",
                        "drug_interaction",
                        "contraindication",
                        "regulatory_warning",
                        "immunogenicity",
                        "contamination_risk",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Finding status
                    <select name="known">
                      <option>unknown</option>
                      <option>observed</option>
                      <option>theoretical</option>
                    </select>
                  </label>
                  <label>
                    Severity / uncertainty
                    <input name="severity" required />
                  </label>
                  <button>Save safety record</button>
                </Op>
              </section>
              <section className="panel">
                <h2>US regulatory record</h2>
                <Op operation="regulatory" revisionId={article.revisionId}>
                  <label>Supporting claim{claims}</label>
                  <label>Authoritative observation{observationSelect}</label>
                  <label>
                    Status
                    <select name="status">
                      {[
                        "unclear",
                        "approved",
                        "investigational",
                        "not_approved",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Record type
                    <select name="recordType">
                      {[
                        "unknown",
                        "drug_approval",
                        "investigational",
                        "compounding",
                        "warning",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Exact product, form, route, and population
                    <input name="product" required />
                  </label>
                  <label>
                    Scoped indication or uncertainty
                    <textarea name="indication" required />
                  </label>
                  <button>Save regulatory record</button>
                </Op>
              </section>
              <section className="panel">
                <h2>Related peptide</h2>
                <p>
                  Relations are public only once both peptides are published.
                  Each needs a supporting claim that explains the shared
                  receptor, pathway, family, area, or structure.
                </p>
                <Op operation="relation" revisionId={article.revisionId}>
                  <label>Supporting relation claim{claims}</label>
                  <label>
                    Related peptide
                    <select name="relatedPeptideId" required>
                      <option value="">Choose a peptide</option>
                      {peptides
                        .filter((p) => p.id !== article.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Relationship
                    <select name="type">
                      <option value="receptor_family">
                        Same receptor family
                      </option>
                      <option value="pathway">Same biological pathway</option>
                      <option value="peptide_family">
                        Similar peptide family
                      </option>
                      <option value="research_area">Same research area</option>
                      <option value="structural">
                        Structural relationship
                      </option>
                    </select>
                  </label>
                  <button>Link related peptide</button>
                </Op>
              </section>
              <section className="panel">
                <h2>Research area or family</h2>
                <Op operation="associate" revisionId={article.revisionId}>
                  <label>Evidence-backed association claim{claims}</label>
                  <label>
                    Type
                    <select name="kind">
                      <option value="area">Research area</option>
                      <option value="family">Family</option>
                    </select>
                  </label>
                  <label>
                    Configured taxonomy slug
                    <input name="slug" required />
                  </label>
                  <button>Link classification</button>
                </Op>
              </section>
            </>
          )}
          <section className="panel">
            <h2>Revision workflow</h2>
            <p>
              Publication checks every claim, flag, five evidence dimensions,
              safety unknowns, and a US regulatory record.
            </p>
            {editable && (
              <Op operation="submit" id={article.revisionId}>
                <button className="outline">Submit for human review</button>
              </Op>
            )}
            {editor && article.status === "needs_review" && (
              <Op operation="publish" id={article.revisionId}>
                <input
                  type="hidden"
                  name="expectedUpdatedAt"
                  value={article.updatedAt}
                />
                <label>
                  Publication reason
                  <textarea name="reason" minLength={10} required />
                </label>
                <button>Publish reviewed revision</button>
              </Op>
            )}
            {!editable && (
              <>
                <p>
                  A new revision can start from this one. Carrying forward
                  copies claims, citations, evidence, safety, regulatory,
                  taxonomy, and relation records, but clears every approval and
                  evidence-assessment review. An editor must re-review all of it
                  before it can publish.
                </p>
                <Op operation="new_revision" id={article.revisionId}>
                  <input type="hidden" name="carry" value="forward" />
                  <button>Start a new revision from this one</button>
                </Op>
                <Op operation="new_revision" id={article.revisionId}>
                  <button className="outline">Start a blank revision</button>
                </Op>
              </>
            )}
            {editor && editable && (
              <Op operation="archive" id={article.revisionId}>
                <button className="outline">Archive draft</button>
              </Op>
            )}
          </section>
        </aside>
      </div>
      {editable && (
        <ResearchRecordForm article={article} observations={observations} />
      )}
      {editable && (
        <section className="panel">
          <h2>Revise draft claims</h2>
          <p>Saving new wording invalidates the existing claim approval.</p>
          {article.claims.map((c) => (
            <details key={c.id}>
              <summary>
                {c.section}: {c.claim_text.slice(0, 100)}
              </summary>
              <Op operation="edit_claim" id={c.id}>
                <input
                  type="hidden"
                  name="expectedUpdatedAt"
                  value={article.updatedAt}
                />
                <label>
                  Scientific claim
                  <textarea
                    name="text"
                    minLength={10}
                    defaultValue={c.claim_text}
                    required
                  />
                </label>
                <label>
                  Plain-English explanation
                  <textarea
                    name="plainText"
                    defaultValue={c.plain_text ?? ""}
                  />
                </label>
                <label>
                  Limitations
                  <textarea
                    name="limitations"
                    minLength={5}
                    defaultValue={c.limitations}
                    required
                  />
                </label>
                <button>Save wording as unreviewed</button>
              </Op>
            </details>
          ))}
        </section>
      )}
      {editable && (
        <section className="panel">
          <h2>AI-assisted extraction</h2>
          <p>
            Use an observation with a permitted source passage. A configured
            extraction provider is required. Output is validated and saved as
            unreviewed claims.
          </p>
          <Op operation="extract" revisionId={article.revisionId}>
            <label>Source observation{observationSelect}</label>
            <button>Extract research draft</button>
          </Op>
        </section>
      )}
      <section id="draft-preview">
        <h2>Authenticated draft preview</h2>
        <ArticleView article={article} preview />
      </section>
    </main>
  );
}
