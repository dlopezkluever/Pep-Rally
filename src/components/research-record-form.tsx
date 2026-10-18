import type { Article } from "@/lib/domain";
import { evidenceType } from "@/lib/domain";
export function ResearchRecordForm({
  article,
  observations,
}: {
  article: Article;
  observations: { id: string; title: string }[];
}) {
  return (
    <section className="panel">
      <h2>Study and mechanism metadata</h2>
      <p>
        Link structured metadata to the same sourced claim. Reuse a study key
        for publications from the same cohort.
      </p>
      <details>
        <summary>Add an evidence record</summary>
        <form action="/api/editorial" method="post" className="stack">
          <input type="hidden" name="operation" value="evidence" />
          <input type="hidden" name="revisionId" value={article.revisionId} />
          <label>
            Claim
            <select name="claimId" required>
              {article.claims.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.claim_text.slice(0, 100)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source observation
            <select name="observationId" required>
              {observations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title.slice(0, 100)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Study or cohort key
            <input
              name="studyKey"
              placeholder="NCT identifier plus cohort, or a reviewed experiment key"
              minLength={3}
              required
            />
          </label>
          <label>
            Study design
            <input name="studyDesign" required />
          </label>
          <label>
            Evidence type
            <select name="type">
              {evidenceType.options.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <label>
            Species, if extracted
            <input name="species" />
          </label>
          <label>
            Population, if extracted
            <input name="population" />
          </label>
          <label>
            Sample size, leave blank if unknown
            <input type="number" name="sampleSize" min={1} />
          </label>
          <label>
            Publication year, if known
            <input type="number" name="year" min={1800} max={2200} />
          </label>
          <label>
            Study title
            <input name="title" minLength={5} required />
          </label>
          <label>
            Summary
            <textarea name="summary" minLength={10} required />
          </label>
          <label>
            Scoped finding
            <textarea name="finding" minLength={10} required />
          </label>
          <label>
            Confidence and reason
            <input name="confidence" minLength={3} required />
          </label>
          <label>
            Limitations
            <textarea name="limitations" minLength={10} required />
          </label>
          <button>Save draft evidence</button>
        </form>
      </details>
      <details>
        <summary>Add a mechanism record</summary>
        <form action="/api/editorial" method="post" className="stack">
          <input type="hidden" name="operation" value="mechanism" />
          <input type="hidden" name="revisionId" value={article.revisionId} />
          <label>
            Supporting mechanism claim
            <select name="claimId">
              {article.claims.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.claim_text.slice(0, 100)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target
            <input name="target" required />
          </label>
          <label>
            Pathway
            <input name="pathway" required />
          </label>
          <label>
            Mechanism confidence
            <select name="confidence">
              {[
                "unknown",
                "proposed",
                "supported_hypothesis",
                "established",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button>Save draft mechanism</button>
        </form>
      </details>
    </section>
  );
}
