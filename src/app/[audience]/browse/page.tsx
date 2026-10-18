import Link from "next/link";
import type { Metadata } from "next";
import { audienceSchema, gradeSchema } from "@/lib/domain";
import { readTaxonomy, searchCatalog } from "@/lib/catalog";
import { Search, EmptyLibrary } from "@/components/shell";
export const metadata: Metadata = { title: "The research library" };
export default async function Browse({
  params,
  searchParams,
}: {
  params: Promise<{ audience: string }>;
  searchParams: Promise<{
    q?: string;
    area?: string;
    family?: string;
    grade?: string;
  }>;
}) {
  const audience = audienceSchema.parse((await params).audience);
  const q = await searchParams;
  const query = (q.q ?? "").slice(0, 160);
  const [cards, terms] = await Promise.all([
    searchCatalog({
      query,
      area: (q.area ?? "").slice(0, 100),
      family: (q.family ?? "").slice(0, 100),
      grade: (q.grade ?? "").slice(0, 50),
    }),
    readTaxonomy(),
  ]);
  return (
    <main id="main" className="page-wrap">
      <p className="eyebrow">The research library</p>
      <h1>Find a clearer perspective.</h1>
      <p className="intro">
        Search a name or alias, or explore the questions being studied.
      </p>
      <Search audience={audience} query={query} />
      <form className="filter-form" method="get">
        <input type="hidden" name="q" value={query} />
        <label>
          Research area
          <select name="area" defaultValue={q.area ?? ""}>
            <option value="">All research areas</option>
            {terms
              .filter((t) => t.kind === "area")
              .map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Peptide family
          <select name="family" defaultValue={q.family ?? ""}>
            <option value="">All families</option>
            {terms
              .filter((t) => t.kind === "family")
              .map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Human evidence
          <select name="grade" defaultValue={q.grade ?? ""}>
            <option value="">All evidence grades</option>
            {gradeSchema.options.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <button>Apply filters</button>
        <Link href={`/${audience}/browse`}>Reset</Link>
      </form>
      <p className="small">
        {cards.length} reviewed profiles{query && ` matching “${query}”`}
      </p>
      {cards.length ? (
        <div className="peptide-grid">
          {cards.map((c) => (
            <Link
              className="peptide-card"
              key={c.id}
              href={`/${audience}/peptides/${c.slug}`}
            >
              <span className="badge">Human evidence: {c.humanGrade}</span>
              <h2>{c.name}</h2>
              <p>{c.summary}</p>
              <p className="small">
                US regulatory status: {c.regulatory.replaceAll("_", " ")}
              </p>
              <span>Read the research ↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <>
          <EmptyLibrary />
          <p>
            No matching published profile is available. Try a shorter name,
            remove a filter, or read{" "}
            <Link href={`/${audience}/evidence`}>how we grade evidence</Link>.
          </p>
        </>
      )}
    </main>
  );
}
