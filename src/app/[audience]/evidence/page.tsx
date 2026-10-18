import type { Metadata } from "next";
export const metadata: Metadata = { title: "How we grade evidence" };
export default function Evidence() {
  return (
    <main id="main" className="page-wrap reading-page">
      <p className="eyebrow">Our editorial approach</p>
      <h1>Evidence needs context.</h1>
      <p className="intro">
        A promising finding is the beginning of a question. Understanding the
        study helps you understand what it can answer.
      </p>
      <section id="peptides">
        <h2>Start with the study.</h2>
        <p>
          Each research profile separates cell, animal, and human studies.
          Researchers examine the exact molecule, experimental setting,
          population, outcome, and follow-up. Those details determine what a
          finding can support.
        </p>
        <p>
          For a technical introduction, see the{" "}
          <a
            href="https://www.genome.gov/genetics-glossary/Peptide"
            target="_blank"
            rel="noreferrer"
          >
            NIH peptide glossary
          </a>
          . Profiles cite the original scientific sources for their specific
          claims.
        </p>
      </section>
      <section>
        <h2>Five dimensions, without an overall score.</h2>
        <dl>
          {[
            [
              "Preclinical evidence",
              "Cell and animal findings, with their model-specific limits.",
            ],
            [
              "Human evidence",
              "Observations and experiments in people, including early studies.",
            ],
            [
              "Clinical evidence",
              "Controlled human findings for the stated question.",
            ],
            [
              "Safety evidence",
              "How well risks are characterized for a specified exposure and population.",
            ],
            [
              "Regulatory maturity",
              "A dated, jurisdiction-specific statement about the exact product or substance.",
            ],
          ].map(([term, desc]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2>What each grade means.</h2>
        <p>
          Grades apply to a specific outcome and context. They are editorial
          judgments using a documented rubric, not a validated medical scoring
          system.
        </p>
        <div className="rubric-list">
          {[
            [
              "Strong",
              "Consistent independent replication with relevant outcomes, adequate precision, and low risk of bias. Clinical Strong requires at least two independent adequately powered randomized trials and an eligible systematic synthesis.",
            ],
            [
              "Moderate",
              "At least two independent studies with consistent findings and no critical bias, with meaningful uncertainty remaining.",
            ],
            [
              "Limited",
              "An interpretable eligible study, or multiple preclinical experiments without independent replication.",
            ],
            [
              "Very Limited",
              "An exploratory experiment, case report, uncontrolled pilot, or evidence with serious limitations.",
            ],
            [
              "None Identified",
              "A completed, documented search found no eligible study for this scope. It does not prove that research cannot exist.",
            ],
            [
              "Conflicting",
              "Comparable eligible studies disagree, and the methodological reason has not been resolved.",
            ],
            [
              "Unknown",
              "Assessment or source retrieval is incomplete. No evidence grade is assigned.",
            ],
          ].map(([term, desc]) => (
            <article key={term}>
              <h3>{term}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <p>
          Reviewers assess study design, independent cohorts, bias,
          applicability, precision, and outcome relevance. Paper counts alone
          never assign a grade. A registry and its publication can represent one
          study.
        </p>
      </section>
      <section id="safety">
        <h2>Unknown is an answer worth seeing.</h2>
        <p>
          Missing long-term observations do not establish long-term safety. A
          strong safety evidence grade can accompany well-characterized serious
          harms. Safety findings and uncertainty appear together on each
          profile.
        </p>
        <p>
          Trial registration does not establish efficacy, drug approval, or
          completed enrollment. Approval applies to a particular product and
          labeled use. Compounding status is recorded separately.
        </p>
      </section>
      <section>
        <h2>Every published claim passes human review.</h2>
        <p>
          Research tools can discover sources and draft interpretations. A human
          editor checks each claim, its supporting passage, evidence context,
          limitations, and the complete revision before publication. Published
          revisions retain their review date and sources.
        </p>
        <p>
          This site is educational. It does not provide diagnosis, dosing, or
          treatment recommendations. It does not replace professional medical
          care.
        </p>
      </section>
    </main>
  );
}
