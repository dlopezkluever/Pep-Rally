import Link from "next/link";
import type { Metadata } from "next";
import { audienceSchema } from "@/lib/domain";
import { searchCatalog, readArticle } from "@/lib/catalog";
export const metadata: Metadata = {
  title: "Compare the research",
  robots: { index: false, follow: true },
};
export default async function Compare({
  params,
  searchParams,
}: {
  params: Promise<{ audience: string }>;
  searchParams: Promise<{ p?: string | string[] }>;
}) {
  const audience = audienceSchema.parse((await params).audience);
  const query = await searchParams;
  const requested = query.p
    ? Array.isArray(query.p)
      ? query.p
      : [query.p]
    : [];
  const ids = [...new Set(requested)];
  const valid = ids.length >= 2 && ids.length <= 4;
  const cards = await searchCatalog();
  const articles = valid
    ? (await Promise.all(ids.map((s) => readArticle(s)))).filter(
        (a) => a !== null,
      )
    : [];
  return (
    <main id="main" className="page-wrap">
      <p className="eyebrow">Context, side by side</p>
      <h1>Compare the research.</h1>
      <p className="intro">
        Compare evidence, study context, safety, and regulatory status for two
        to four reviewed profiles.
      </p>
      <form method="get" className="panel">
        <fieldset>
          <legend>Choose two to four peptides</legend>
          <div className="compare-options">
            {cards.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  name="p"
                  value={c.slug}
                  defaultChecked={ids.includes(c.slug)}
                />
                {c.name}
              </label>
            ))}
          </div>
          {!cards.length && (
            <p>
              Comparison becomes available when the first profiles complete
              editorial review.
            </p>
          )}
        </fieldset>
        <button disabled={cards.length < 2}>Compare selected profiles</button>
      </form>
      {ids.length > 0 && !valid && (
        <p role="alert">Select two to four distinct profiles.</p>
      )}
      {valid && articles.length !== ids.length && (
        <p role="alert">
          One or more selected profiles are not currently published.
        </p>
      )}
      {articles.length >= 2 && (
        <div
          className="table-scroll"
          role="region"
          aria-label="Peptide research comparison"
          tabIndex={0}
        >
          <table>
            <caption>
              Evidence describes the included research, not suitability for
              personal use.
            </caption>
            <thead>
              <tr>
                <th scope="col">Research dimension</th>
                {articles.map((a) => (
                  <th key={a.id} scope="col">
                    <Link href={`/${audience}/peptides/${a.slug}`}>
                      {a.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                "overview",
                "mechanism",
                "research_areas",
                "human",
                "animal",
                "trials",
                "safety",
                "regulatory",
              ].map((row) => (
                <tr key={row}>
                  <th scope="row">{row.replaceAll("_", " ")}</th>
                  {articles.map((a) => (
                    <td key={a.id}>
                      {row === "trials"
                        ? `${a.trialCount} linked registry records`
                        : a.claims
                            .filter((c) => c.section === row)
                            .map((c) => (
                              <p key={c.id}>
                                {c.plain_text ?? c.claim_text}{" "}
                                <small>
                                  {c.evidence_type.replaceAll("_", " ")}
                                </small>
                              </p>
                            ))}
                      {!a.claims.some((c) => c.section === row) &&
                        row !== "trials" &&
                        "No separate included finding."}
                    </td>
                  ))}
                </tr>
              ))}
              {["preclinical", "human", "clinical", "safety"].map((d) => (
                <tr key={d}>
                  <th scope="row">{d} evidence grade</th>
                  {articles.map((a) => (
                    <td key={a.id}>
                      {a.assessments.find((x) => x.dimension === d)?.grade ??
                        "Unknown"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
