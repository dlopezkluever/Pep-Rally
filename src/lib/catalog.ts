import { z } from "zod";
import { value } from "./db";
import { articleSchema, cardSchema, taxonomySchema } from "./domain";
export async function searchCatalog(
  input: {
    query?: string;
    area?: string;
    family?: string;
    grade?: string;
  } = {},
) {
  return value(
    "SELECT wiki.catalog_list($1,$2,$3,$4) AS data",
    [
      input.query ?? "",
      input.area ?? "",
      input.family ?? "",
      input.grade ?? "",
    ],
    z.array(cardSchema),
  );
}
export async function readArticle(slug: string) {
  const id = await value(
    "SELECT wiki.resolve_peptide($1) AS data",
    [slug],
    z.uuid().nullable(),
  );
  return id
    ? value(
        "SELECT wiki.article_data($1,false) AS data",
        [id],
        articleSchema.nullable(),
      )
    : null;
}
export async function previewArticle(revisionId: string, actorId: string) {
  return value(
    "SELECT wiki.article_data($1,true) AS data",
    [revisionId],
    articleSchema.nullable(),
    actorId,
  );
}
export async function readTaxonomy() {
  return value(
    "SELECT wiki.public_taxonomy() AS data",
    [],
    z.array(taxonomySchema),
  );
}
export async function readHistory(id: string) {
  return value(
    "SELECT wiki.public_history($1) AS data",
    [id],
    z.array(z.object({ date: z.string(), reason: z.string() })),
  );
}
