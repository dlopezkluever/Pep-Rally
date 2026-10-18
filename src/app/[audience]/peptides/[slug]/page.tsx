import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { audienceSchema } from "@/lib/domain";
import { readArticle, readHistory } from "@/lib/catalog";
import { ArticleView } from "@/components/article";
type Props = { params: Promise<{ audience: string; slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await readArticle(slug);
  if (!a) return { title: "Profile unavailable", robots: { index: false } };
  const summary = a.claims.find((c) => c.section === "overview");
  return {
    title: `${a.name}: evidence, safety & research`,
    description: (summary?.plain_text ?? summary?.claim_text ?? "").slice(
      0,
      160,
    ),
    alternates: { canonical: `/women/peptides/${a.slug}` },
    openGraph: { title: `${a.name} research profile`, type: "article" },
  };
}
export default async function Peptide({ params }: Props) {
  const { slug, audience: variant } = await params;
  const audience = audienceSchema.parse(variant);
  const a = await readArticle(slug);
  if (!a) notFound();
  const history = await readHistory(a.id);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${a.name} research profile`,
    dateModified: a.reviewedAt,
    url: `${process.env.SITE_URL}/women/peptides/${a.slug}`,
    citation: [
      ...new Set(a.claims.flatMap((c) => c.citations.map((r) => r.url))),
    ],
  };
  return (
    <main id="main" className="page-wrap">
      <Link href={`/${audience}/browse`} className="breadcrumb">
        ← The library
      </Link>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replaceAll("<", "\\u003c"),
        }}
      />
      <ArticleView article={a} audience={audience} />
      <details className="panel">
        <summary>Editorial history</summary>
        {history.map((h, i) => (
          <p key={i}>
            {h.date.slice(0, 10)}: {h.reason}
          </p>
        ))}
      </details>
    </main>
  );
}
