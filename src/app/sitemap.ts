import type { MetadataRoute } from "next";
import { searchCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cards = await searchCatalog();
  const base = process.env.SITE_URL ?? "http://127.0.0.1:3048";
  return [
    { url: `${base}/women` },
    { url: `${base}/women/browse` },
    { url: `${base}/women/evidence` },
    ...cards.map((c) => ({
      url: `${base}/women/peptides/${c.slug}`,
      lastModified: c.reviewedAt ?? undefined,
    })),
  ];
}
