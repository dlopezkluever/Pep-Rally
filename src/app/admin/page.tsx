import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/lib/auth";
import { queue, sources } from "@/lib/editorial";
import { signOut } from "@/app/login/actions";
export const metadata: Metadata = {
  title: "Editorial workspace",
  robots: { index: false, follow: false },
};
function Operation({
  operation,
  id,
  children,
}: {
  operation: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <form action="/api/editorial" method="post" className="inline-form">
      <input type="hidden" name="operation" value={operation} />
      {id && <input type="hidden" name="id" value={id} />} {children}
    </form>
  );
}
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const actor = await requireActor();
  const [items, observations] = await Promise.all([
    queue(actor),
    sources(actor),
  ]);
  const message = await searchParams;
  const editor = ["editor", "admin"].includes(actor.role);
  return (
    <main className="admin-wrap" id="main">
      <header className="admin-header">
        <Link className="wordmark" href="/">
          peppy tides<span>Editorial workspace</span>
        </Link>
        <div>
          <span>
            {actor.display_name} · {actor.role}
          </span>
          <form action={signOut}>
            <button className="outline">Sign out</button>
          </form>
        </div>
      </header>
      <p className="eyebrow">Research → draft → human review → publication</p>
      <h1>A careful path to publication.</h1>
      <p className="intro">
        Sources, machine interpretations, and approved claims remain distinct.
        Every seed is unreviewed.
      </p>
      {message.error && (
        <p role="alert" className="notice danger">
          {message.error}
        </p>
      )}
      {message.success && (
        <p role="status" className="notice">
          {message.success}
        </p>
      )}
      <div className="stat-grid">
        <div>
          <strong>{items.length}</strong>
          <span>Peptide identities</span>
        </div>
        <div>
          <strong>{items.filter((x) => x.claims > 0).length}</strong>
          <span>Research drafts</span>
        </div>
        <div>
          <strong>
            {items.filter((x) => x.status === "needs_review").length}
          </strong>
          <span>Needs review</span>
        </div>
        <div>
          <strong>
            {items.filter((x) => x.status === "published").length}
          </strong>
          <span>Latest revision published</span>
        </div>
      </div>
      <section className="panel">
        <h2>Research queue</h2>
        <div className="table-scroll">
          <table>
            <caption>Latest revision for each peptide</caption>
            <thead>
              <tr>
                <th scope="col">Peptide</th>
                <th scope="col">Stage</th>
                <th scope="col">Claim reviews</th>
                <th scope="col">Flags</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <Link href={`/admin/revisions/${p.revision_id}`}>
                      {p.name}
                    </Link>
                  </th>
                  <td>
                    <span className="badge">
                      {p.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    {p.approved} / {p.claims}
                  </td>
                  <td>{p.open_flags}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/revisions/${p.revision_id}`}>
                        Open draft ↗
                      </Link>
                      <Operation operation="discover" id={p.revision_id}>
                        <button className="outline compact">
                          Queue research
                        </button>
                      </Operation>
                      {p.status === "published" && editor && (
                        <Operation operation="withdraw" id={p.id}>
                          <input
                            aria-label={`Withdrawal reason for ${p.name}`}
                            name="reason"
                            placeholder="Withdrawal reason"
                            minLength={10}
                            required
                          />
                          <button className="outline compact">Unpublish</button>
                        </Operation>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Add a peptide identity</h2>
        <Operation operation="create">
          <label>
            Canonical name
            <input name="name" minLength={2} maxLength={120} required />
          </label>
          <label>
            URL slug
            <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
          </label>
          <button>Create draft</button>
        </Operation>
      </section>
      {editor && (
        <section className="panel">
          <h2>Configure discovery taxonomy</h2>
          <Operation operation="taxonomy">
            <label>
              Type
              <select name="kind">
                <option value="area">Research area</option>
                <option value="family">Peptide family</option>
              </select>
            </label>
            <label>
              Label
              <input name="label" required />
            </label>
            <label>
              Slug
              <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
            </label>
            <button>Save taxonomy</button>
          </Operation>
        </section>
      )}
      <section className="panel">
        <h2>Ingest a primary source</h2>
        <Operation operation="source">
          <label>
            Stable source identifier
            <input
              name="identity"
              placeholder="pmid-12345678 or doi-10.x/example"
              required
            />
          </label>
          <label>
            Title
            <input name="title" minLength={5} required />
          </label>
          <label>
            Original HTTPS source URL
            <input type="url" name="url" required />
          </label>
          <label>
            Access scope
            <select name="scope">
              {[
                "metadata",
                "abstract",
                "full_text",
                "registry",
                "regulatory",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Permitted source passage
            <textarea
              name="text"
              placeholder="Optional. Store only text you have a documented basis to retain."
            />
          </label>
          <label>
            Rights or permission basis
            <textarea name="permission" minLength={10} required />
          </label>
          <button>Save source observation</button>
        </Operation>
      </section>
      <section className="panel">
        <p className="eyebrow">
          Source text ≠ AI interpretation ≠ approved claim
        </p>
        <h2>Source viewer</h2>
        <p>
          Imported validation notes are original AI interpretations. Original
          passages must be inspected before claim approval.
        </p>
        {observations.map((s) => (
          <details className="source-detail" key={s.id}>
            <summary>
              {s.title} <span className="badge">{s.text_scope}</span>
            </summary>
            <p>
              <a href={s.url} target="_blank" rel="noreferrer">
                Open original source ↗
              </a>
            </p>
            <p>
              Retrieved {s.retrieved_at.slice(0, 10)} · Cited by {s.claims}{" "}
              draft claims
            </p>
            <p className="small">Observation ID: {s.id}</p>
            <h3>Source text</h3>
            <p>
              {s.source_text ??
                "Original text is not stored in this observation. Follow the source link and verify the claim locator."}
            </p>
            <h3>Research notes and interpretation</h3>
            <pre>{s.notes ?? "No notes"}</pre>
            <p className="small">{s.license_note}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
