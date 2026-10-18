import Link from "next/link";
import type { Audience } from "@/lib/domain";
import { Analytics } from "./analytics";
export function Shell({
  audience,
  children,
}: {
  audience: Audience;
  children: React.ReactNode;
}) {
  const root = `/${audience}`;
  return (
    <div
      className={`experience ${audience === "50plus" ? "accessible" : "editorial"}`}
    >
      <Analytics audience={audience} />
      <a href="#main" className="skip">
        Skip to content
      </a>
      <div className="topline">
        An independent guide to peptide research{" "}
        <span>Evidence before expectations.</span>
      </div>
      <header className="site-header">
        <Link href={root} className="wordmark">
          peppy tides<span>Research, in perspective.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href={`${root}/browse`}>The library</Link>
          <Link href={`${root}/evidence`}>Understanding evidence</Link>
          <Link href={`${root}/compare`}>Compare research</Link>
        </nav>
        <details className="view-menu">
          <summary>Reading view</summary>
          <div>
            <Link href="/women">Editorial</Link>
            <Link href="/50plus">Comfort reading</Link>
          </div>
        </details>
      </header>
      {children}
      <footer>
        <div>
          <Link href={root} className="wordmark">
            peppy tides
          </Link>
          <p>A clearer view of the science.</p>
        </div>
        <div>
          <p>
            For education. Content does not replace professional medical care.
          </p>
          <p>
            Research changes. Inclusion does not establish efficacy. Animal
            findings may not translate to humans.
          </p>
          <div className="footer-links">
            <Link href={`${root}/evidence`}>Our evidence approach</Link>
            <Link href="/login">Researcher sign in</Link>
          </div>
          <p className="small">
            Source services include NCBI, ClinicalTrials.gov, and FDA. No
            endorsement is implied.
          </p>
        </div>
      </footer>
    </div>
  );
}
export function Search({
  audience,
  query = "",
}: {
  audience: Audience;
  query?: string;
}) {
  return (
    <form action={`/${audience}/browse`} role="search" className="search">
      <label htmlFor="peptide-search" className="sr-only">
        Search peptide names, aliases, or research topics
      </label>
      <span aria-hidden="true">⌕</span>
      <input
        id="peptide-search"
        name="q"
        type="search"
        placeholder="A peptide, a question, a research area…"
        defaultValue={query}
        maxLength={160}
      />
      <button>
        Search <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
export function EmptyLibrary() {
  return (
    <section className="empty-state">
      <span className="status-dot" />
      <h3>The library is taking shape.</h3>
      <p>
        Our first profiles are being researched. Articles appear here after
        human editorial review.
      </p>
      <p className="small">
        Explore our evidence guide while the first reviews are underway.
      </p>
    </section>
  );
}
