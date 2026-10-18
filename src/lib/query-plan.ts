import { normalizeName } from "./domain";

/** PRD section 7 literature query set. `{n}` is the quoted peptide name. */
const literatureTemplates = [
  { id: "name", suffix: "", limit: 60 },
  { id: "human", suffix: " human", limit: 20 },
  { id: "clinical_trial", suffix: " clinical trial", limit: 20 },
  { id: "randomized", suffix: " randomized", limit: 20 },
  { id: "pharmacokinetics", suffix: " pharmacokinetics", limit: 20 },
  { id: "mechanism", suffix: " mechanism", limit: 20 },
  { id: "safety", suffix: " safety", limit: 20 },
  { id: "toxicity", suffix: " toxicity", limit: 20 },
  { id: "animal", suffix: " animal", limit: 20 },
  { id: "review", suffix: " review", limit: 20 },
] as const;
/** Aliases widen recall only; each gets the bare name and the human-research query. */
const aliasTemplateIds = new Set(["name", "human"]);
export const maxAliasesSearched = 4;

export interface PlannedQuery {
  id: string;
  /** Name searched: the canonical name or one alias. */
  subject: string;
  /** Exact text submitted to the source. */
  text: string;
  /** Most records to retrieve for this query. */
  limit: number;
}
function quoted(name: string) {
  return `"${name.replaceAll('"', "").trim()}"`;
}
/**
 * Distinct names to search: the canonical name first, then aliases that do not
 * normalize to a name already present, capped so a long alias list cannot
 * multiply requests without bound.
 */
export function searchSubjects(canonical: string, aliases: string[]) {
  const seen = new Set([normalizeName(canonical)]);
  const subjects = [canonical.trim()];
  for (const alias of aliases) {
    const key = normalizeName(alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    subjects.push(alias.trim());
    if (subjects.length > maxAliasesSearched) break;
  }
  return subjects;
}
export function buildLiteratureQueryPlan(
  canonical: string,
  aliases: string[],
): PlannedQuery[] {
  const [first, ...rest] = searchSubjects(canonical, aliases);
  const plan: PlannedQuery[] = literatureTemplates.map((t) => ({
    id: t.id,
    subject: first,
    text: `${quoted(first)}${t.suffix}`,
    limit: t.limit,
  }));
  for (const alias of rest)
    for (const t of literatureTemplates)
      if (aliasTemplateIds.has(t.id))
        plan.push({
          id: `alias-${t.id}`,
          subject: alias,
          text: `${quoted(alias)}${t.suffix}`,
          limit: 20,
        });
  return plan;
}
