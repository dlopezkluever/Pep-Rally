import type { Article } from "@/lib/domain";
import { sectionSchema } from "@/lib/domain";
import Link from "next/link";

const headings = {
  overview: "What is it?",
  mechanism: "How it works",
  research_areas: "Research areas",
  human: "Human research",
  animal: "Animal research",
  cell: "Cell & in-vitro research",
  trials: "Clinical trials",
  safety: "Safety & important limitations",
  unknowns: "What we do not know",
  regulatory: "Regulatory status",
  timeline: "Research timeline",
  related: "Related peptides",
};
/** Date the cited registry snapshot was retrieved, taken from the claim citation of the same observation. */
function retrievedOn(article: Article, observationId: string) {
  const retrieved = article.claims
    .flatMap((c) => c.citations)
    .find((c) => c.id === observationId)?.retrievedAt;
  return retrieved
    ? new Date(retrieved).toISOString().slice(0, 10)
    : "on an unrecorded date";
}
export function ArticleView({
  article,
  preview = false,
  audience = "women",
}: {
  article: Article;
  preview?: boolean;
  audience?: "women" | "50plus";
}) {
  const references = [
    ...new Map(
      article.claims.flatMap((c) => c.citations).map((c) => [c.id, c]),
    ).values(),
  ];
  const number = (id: string) => references.findIndex((r) => r.id === id) + 1;
  return (
    <>
      {preview && (
        <aside className="notice danger">
          <strong>Unreviewed research draft.</strong> This preview is not
          published. Machine summaries and source interpretations require human
          review.
        </aside>
      )}
      <div className="article-top">
        <p className="eyebrow">The research library / Peptide profile</p>
        <h1>{article.name}</h1>
        <p className="aliases">
          {article.aliases.join(" · ") || "Aliases not yet assessed"}
        </p>
        <div className="article-meta">
          <span>
            {preview
              ? "Draft"
              : `Reviewed ${article.reviewedAt ? new Date(article.reviewedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not reviewed"}`}
          </span>
          <span>{references.length} included references</span>
          <span>{article.humanStudyCount} included human study records</span>
          <span>{article.trialCount} linked trials</span>
        </div>
      </div>
      <section aria-labelledby="snapshot" className="evidence-snapshot">
        <div>
          <p className="eyebrow">Start with the evidence</p>
          <h2 id="snapshot">What does the research support?</h2>
        </div>
        <div className="grade-grid">
          {["preclinical", "human", "clinical", "safety", "regulatory"].map(
            (d) => {
              const a = article.assessments.find((x) => x.dimension === d);
              return (
                <details key={d}>
                  <summary>
                    <span>
                      {d === "preclinical"
                        ? "Cell & animal"
                        : d === "regulatory"
                          ? "US regulatory"
                          : `${d[0].toUpperCase()}${d.slice(1)} evidence`}
                    </span>
                    <strong>
                      {d === "regulatory"
                        ? (article.regulations
                            .find((r) => r.jurisdiction === "United States")
                            ?.status.replaceAll("_", " ") ?? "Unknown")
                        : (a?.grade ?? "Unknown")}
                    </strong>
                    <small>How this was assessed +</small>
                  </summary>
                  <p>
                    {a?.rationale ?? "This dimension has not been assessed."}
                  </p>
                  <p className="small">
                    {a?.search_scope} {a && `Rubric ${a.rubric_version}.`}
                  </p>
                </details>
              );
            },
          )}
        </div>
      </section>
      <div className="article-layout">
        <nav className="contents" aria-label="On this page">
          <p className="eyebrow">In this profile</p>
          {sectionSchema.options.map((s) => (
            <a key={s} href={`#${s}`}>
              {headings[s]}
            </a>
          ))}
          <a href="#references">References</a>
        </nav>
        <div className="article-body">
          <aside className="notice">
            <strong>Read the limits with the findings.</strong> Safety evidence
            describes how well risks are characterized. It does not mean a
            compound is safe.{" "}
            {article.safety.length === 0 &&
              "Safety has not yet been assessed in this draft."}
          </aside>
          {sectionSchema.options.map((section) => (
            <section
              key={section}
              id={section}
              className={
                section === "safety" || section === "unknowns"
                  ? "science-section safety-section"
                  : "science-section"
              }
            >
              <p className="eyebrow">
                {section === "human"
                  ? "People, populations & study limits"
                  : section === "animal" || section === "cell"
                    ? "Preclinical evidence"
                    : ""}
              </p>
              <h2>{headings[section]}</h2>
              {article.claims
                .filter((c) => c.section === section)
                .map((claim) => (
                  <div key={claim.id} className="claim">
                    <span className={`badge context-${claim.assertion_scope}`}>
                      {claim.evidence_type.replaceAll("_", " ")}
                    </span>
                    <p>
                      {claim.plain_text ?? claim.claim_text}{" "}
                      <span className="citation-links">
                        {claim.citations.map((c) => (
                          <a
                            key={`${c.id}-${c.locator}`}
                            href={`#ref-${number(c.id)}`}
                            title={`${c.title}. ${c.scope}. ${c.locator}`}
                            aria-label={`Reference ${number(c.id)}: ${c.title}`}
                          >
                            [{number(c.id)}]
                          </a>
                        ))}
                      </span>
                    </p>
                    {claim.plain_text && (
                      <details>
                        <summary>Scientific explanation</summary>
                        <p>{claim.claim_text}</p>
                      </details>
                    )}
                    <p className="limitation">
                      <strong>Limits:</strong> {claim.limitations}
                    </p>
                    {preview && (
                      <p className="small">
                        {claim.approved
                          ? "Human-approved claim"
                          : "Awaiting claim review"}
                      </p>
                    )}
                  </div>
                ))}
              {article.claims.every((c) => c.section !== section) && (
                <p className="muted">
                  {preview
                    ? "Not yet assessed in this draft."
                    : "No separate finding is included in this reviewed profile. See the search scope and limitations above."}
                </p>
              )}
              {["human", "animal", "cell"].includes(section) &&
                article.evidenceRecords
                  .filter((e) =>
                    section === "animal"
                      ? e.evidence_type === "animal"
                      : section === "cell"
                        ? e.evidence_type === "in_vitro"
                        : [
                            "case_report",
                            "observational",
                            "pilot_human",
                            "clinical_trial",
                            "randomized_controlled_trial",
                          ].includes(e.evidence_type),
                  )
                  .map((e) => (
                    <details key={e.id} className="trial-card">
                      <summary>Study context: {e.title}</summary>
                      <dl>
                        <div>
                          <dt>Study design</dt>
                          <dd>{e.study_design ?? "Not yet extracted"}</dd>
                        </div>
                        <div>
                          <dt>Species / population</dt>
                          <dd>
                            {e.species ?? "Not extracted"} /{" "}
                            {e.population ?? "Not extracted"}
                          </dd>
                        </div>
                        <div>
                          <dt>Sample size</dt>
                          <dd>{e.sample_size ?? "Unknown"}</dd>
                        </div>
                        <div>
                          <dt>Limitations</dt>
                          <dd>{e.limitations}</dd>
                        </div>
                      </dl>
                    </details>
                  ))}
              {section === "related" &&
                article.related.map((r) => (
                  <p key={`${r.slug}-${r.type}`}>
                    <Link href={`/${audience}/peptides/${r.slug}`}>
                      {r.name}
                    </Link>{" "}
                    · {r.type.replaceAll("_", " ")}
                  </p>
                ))}
              {section === "trials" && article.trials.length > 0 && (
                <p className="small" data-testid="registry-notice">
                  Trial details come from the registries linked on each card,
                  including ClinicalTrials.gov, a service of the U.S. National
                  Institutes of Health. They are selected and summarized here,
                  not reproduced in full, and may be incomplete. Registry
                  entries change, so open each record for current information.
                </p>
              )}
              {section === "trials" &&
                article.trials.map((t) => (
                  <article className="trial-card" key={t.id}>
                    <p className="eyebrow">
                      {t.registry_id} · {t.phase ?? "Phase unspecified"}
                    </p>
                    <h3>
                      <a href={t.source_url} target="_blank" rel="noreferrer">
                        {t.title} ↗
                      </a>
                    </h3>
                    <p>
                      {t.status.replaceAll("_", " ")} · Enrollment:{" "}
                      {t.enrollment ?? "Unknown"} {t.enrollment_type ?? ""}
                    </p>
                    <p>{t.population}</p>
                    <p>Intervention: {t.intervention ?? "Not extracted"}</p>
                    <p>
                      Primary outcomes: {t.primary_outcomes ?? "Not extracted"}
                    </p>
                    <p className="small">
                      Registry snapshot retrieved{" "}
                      {retrievedOn(article, t.observation_id)}.
                    </p>
                    <p>
                      {t.results_available
                        ? "Registry results are posted."
                        : "No posted registry results in this snapshot."}{" "}
                      Registration alone does not establish efficacy.
                    </p>
                  </article>
                ))}
              {section === "regulatory" &&
                article.regulations.map((r) => (
                  <p key={r.id}>
                    {r.jurisdiction} / {r.agency}:{" "}
                    <strong>{r.status.replaceAll("_", " ")}</strong>.{" "}
                    {r.product} {r.indication} Verified{" "}
                    {new Date(r.verified_at).toISOString().slice(0, 10)}.
                  </p>
                ))}
            </section>
          ))}
          <section id="references" className="science-section">
            <p className="eyebrow">Follow the original science</p>
            <h2>References</h2>
            <p>
              Source scope describes what was inspected. A registry entry and
              its publication may describe the same study.
            </p>
            <div className="reference-filters" aria-label="Reference filters">
              <a href="#references">All</a>
              {[
                "Human",
                "Animal",
                "In Vitro",
                "Reviews",
                "Clinical Trials",
                "Regulatory",
              ].map((label) => (
                <a key={label} href={`#refs-${label.replaceAll(" ", "-")}`}>
                  {label}
                </a>
              ))}
            </div>
            <ol className="references">
              {references.map((ref, i) => (
                <li id={`ref-${i + 1}`} key={ref.id}>
                  <a href={ref.url} target="_blank" rel="noreferrer">
                    {ref.title} ↗
                  </a>
                  <p>
                    {ref.authors.join(", ")} {ref.publication}{" "}
                    {ref.date?.slice(0, 10)}
                  </p>
                  <details>
                    <summary>Source and provenance</summary>
                    <p>
                      Access scope: {ref.scope}. Retrieved:{" "}
                      {new Date(ref.retrievedAt).toISOString().slice(0, 10)}.
                    </p>
                    <p>
                      Locator: {ref.locator}. Citation relationship:{" "}
                      {ref.relation}.
                    </p>
                  </details>
                </li>
              ))}
            </ol>
            {[
              "Human",
              "Animal",
              "In Vitro",
              "Reviews",
              "Clinical Trials",
              "Regulatory",
            ].map((label) => {
              const kinds =
                label === "Human"
                  ? [
                      "case_report",
                      "observational",
                      "pilot_human",
                      "clinical_trial",
                      "randomized_controlled_trial",
                    ]
                  : label === "Animal"
                    ? ["animal"]
                    : label === "In Vitro"
                      ? ["in_vitro"]
                      : label === "Reviews"
                        ? ["systematic_review", "meta_analysis"]
                        : label === "Regulatory"
                          ? ["regulatory"]
                          : [];
              const ids = new Set(
                article.claims
                  .filter(
                    (c) =>
                      kinds.includes(c.evidence_type) ||
                      (label === "Clinical Trials" && c.section === "trials"),
                  )
                  .flatMap((c) => c.citations.map((r) => r.id)),
              );
              return (
                <details id={`refs-${label.replaceAll(" ", "-")}`} key={label}>
                  <summary>
                    {label} references ({ids.size})
                  </summary>
                  {references
                    .filter((r) => ids.has(r.id))
                    .map((r) => (
                      <p key={r.id}>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          {r.title}
                        </a>
                      </p>
                    ))}
                  {ids.size === 0 && (
                    <p>
                      No separately classified reference in this included set.
                    </p>
                  )}
                </details>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}
