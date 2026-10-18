import Link from "next/link";
import { audienceSchema } from "@/lib/domain";
import { searchCatalog, readTaxonomy } from "@/lib/catalog";
import { Search, EmptyLibrary } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Home({
  params,
}: {
  params: Promise<{ audience: string }>;
}) {
  const audience = audienceSchema.parse((await params).audience);
  const root = `/${audience}`;
  const [cards, taxonomy] = await Promise.all([
    searchCatalog(),
    readTaxonomy(),
  ]);
  const areas = taxonomy.filter((t) => t.kind === "area");
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> A considered guide to peptide
            science
          </p>
          <h1>
            Curiosity deserves
            <br />
            <em>clearer answers.</em>
          </h1>
          <p className="hero-description">
            Understand what peptides are, what researchers have found, and what
            we still don’t know. Every finding, with its evidence in view.
          </p>
          <Search audience={audience} />
          <div className="search-hints">
            <span>Start with a name.</span>
            <span>Follow a research question.</span>
            <span>See the strength of the evidence.</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="orb orb-three" />
          <span className="art-label">
            A small molecule.
            <br />A bigger scientific question.
          </span>
          <span className="art-coordinate">01 / CONNECTING THE EVIDENCE</span>
        </div>
      </section>
      <div className="trust-strip">
        <p>
          Built around evidence.
          <br />
          <strong>Designed for understanding.</strong>
        </p>
        <span>
          Human & animal research,
          <br />
          clearly distinguished
        </span>
        <span>
          Original sources,
          <br />
          always within reach
        </span>
        <span>
          Uncertainty,
          <br />
          made visible
        </span>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Follow your curiosity</p>
            <h2>Explore a research area.</h2>
          </div>
          <Link href={`${root}/browse`}>View the library ↗</Link>
        </div>
        <div className="area-grid">
          {areas.slice(0, 8).map((a, i) => (
            <Link
              className={`area-card area-${i % 4}`}
              href={`${root}/browse?area=${a.slug}`}
              key={a.slug}
            >
              <span className="area-number">0{i + 1}</span>
              <span className="area-symbol" aria-hidden="true">
                {["◌", "⌘", "◈", "∿"][i % 4]}
              </span>
              <h3>{a.label}</h3>
              <span className="small">
                Explore the research <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="small muted">
          Research areas describe questions scientists investigate. An
          association is not an established benefit.
        </p>
      </section>
      <section className="home-section library-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Read with perspective</p>
            <h2>Inside the library.</h2>
          </div>
          <Link href={`${root}/browse`}>All profiles ↗</Link>
        </div>
        {cards.length ? (
          <div className="peptide-grid">
            {cards.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`${root}/peptides/${c.slug}`}
                className="peptide-card"
              >
                <span className="badge">Human evidence: {c.humanGrade}</span>
                <h3>{c.name}</h3>
                <p>{c.summary}</p>
                <span className="small">Read profile ↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyLibrary />
        )}
      </section>
      <section className="evidence-feature">
        <div>
          <p className="eyebrow">A study is a starting point.</p>
          <h2>
            The type of evidence
            <br />
            <em>changes the story.</em>
          </h2>
          <p>
            A finding in a cell is different from a finding in a person. We keep
            those distinctions visible, so you can read the research with
            context.
          </p>
          <Link className="button outline" href={`${root}/evidence`}>
            How we read the evidence ↗
          </Link>
        </div>
        <ol className="evidence-ladder">
          {[
            ["01", "Cell research", "A closer look at biological processes."],
            [
              "02",
              "Animal research",
              "Findings in models, with limits to translation.",
            ],
            [
              "03",
              "Human research",
              "People, study design, and real-world relevance.",
            ],
            [
              "04",
              "Clinical evidence",
              "Controlled findings for a specific question.",
            ],
          ].map(([n, t, d]) => (
            <li key={n}>
              <span>{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="home-section">
        <p className="eyebrow">A little context goes a long way</p>
        <h2>Understand before you explore.</h2>
        <div className="learning-grid">
          <Link href={`${root}/evidence#peptides`}>
            <span>THE BASICS / 01</span>
            <h3>
              What is a peptide,
              <br />
              exactly?
            </h3>
            <p>Start with the language of the research.</p>
            <b aria-hidden="true">↗</b>
          </Link>
          <Link href={`${root}/evidence#safety`}>
            <span>SAFETY / 02</span>
            <h3>
              What “unknown”
              <br />
              really means.
            </h3>
            <p>Missing evidence deserves a clear label.</p>
            <b aria-hidden="true">↗</b>
          </Link>
          <Link href={`${root}/compare`}>
            <span>PERSPECTIVE / 03</span>
            <h3>Compare the research.</h3>
            <p>See study context and uncertainty side by side.</p>
            <b aria-hidden="true">↗</b>
          </Link>
        </div>
      </section>
    </main>
  );
}
