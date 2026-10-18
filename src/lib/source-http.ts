import { z } from "zod";
import { transaction } from "./db";

export const sourceSchema = z.object({
  identity: z.string(),
  type: z.string(),
  title: z.string(),
  url: z.url(),
  scope: z.enum([
    "metadata",
    "registry",
    "regulatory",
    "abstract",
    "full_text",
  ]),
  notes: z.string(),
  identifiers: z.record(z.string(), z.string()).default({}),
});
export type DiscoverySource = z.infer<typeof sourceSchema>;
/** A discovered source plus every query that matched it. Queries are search provenance, not source content. */
export interface FoundSource {
  source: DiscoverySource;
  queries: string[];
}
export interface SearchRecord {
  query: string;
  url: string;
  /** Matches the service reports for the query; null when the service does not say. */
  total: number | null;
  retrieved: number;
  truncated: boolean;
  pages: number;
  translation?: string;
  /** Source release the response came from, when the service reports one. */
  release?: string;
}
export interface AdapterContext {
  name: string;
  aliases: string[];
  seeds: Partial<Record<"pubchem" | "uniprot" | "iuphar", string>>;
  fetch: Fetcher;
}
export interface AdapterRun {
  found: FoundSource[];
  searches: SearchRecord[];
  /** Set when the adapter deliberately did not run, for example a missing credential. */
  skipped?: string;
}
export type Adapter = (ctx: AdapterContext) => Promise<AdapterRun>;
export type Fetcher = (
  url: URL,
  options?: RequestInit,
) => Promise<{ body: unknown; headers: Headers }>;

export class SourceHttpError extends Error {
  constructor(
    readonly status: number,
    readonly host: string,
  ) {
    super(`Source HTTP ${status}`);
  }
}
const allowedHosts = new Set([
  "eutils.ncbi.nlm.nih.gov",
  "clinicaltrials.gov",
  "pubchem.ncbi.nlm.nih.gov",
  "api.fda.gov",
  "www.guidetopharmacology.org",
  "data.rcsb.org",
  "search.rcsb.org",
  "rest.uniprot.org",
]);
export const fetchOfficialResponse: Fetcher = async (url, options = {}) => {
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname))
    throw new Error("Unapproved source host");
  for (let attempt = 0; attempt < 3; attempt++) {
    const gap = await transaction(null, async (c) => {
      const r = await c.query(
        "INSERT INTO wiki.rate_bucket(key,hits,reset_at) VALUES($1,0,now()) ON CONFLICT(key) DO UPDATE SET reset_at=greatest(rate_bucket.reset_at+interval '2 seconds',now()) RETURNING greatest(0,extract(epoch FROM(reset_at-now()))*1000) AS delay",
        [`source:${url.hostname}`],
      );
      return z.object({ delay: z.coerce.number() }).parse(r.rows[0]).delay;
    });
    if (gap > 30000)
      throw new Error("Shared source request budget is busy; retry later");
    if (gap) await new Promise((resolve) => setTimeout(resolve, gap));
    const response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
    if (response.ok) {
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 5_000_000)
        throw new Error("Source response exceeds limit");
      // 204 and empty bodies mean "no matches" for some search services.
      return {
        body: bytes.byteLength
          ? JSON.parse(new TextDecoder().decode(bytes))
          : null,
        headers: response.headers,
      };
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2)
      throw new SourceHttpError(response.status, url.hostname);
    const retry = Number(response.headers.get("retry-after"));
    if (retry > 30) throw new Error("Source asks for a later retry");
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        retry > 0 ? retry * 1000 : 1000 * 2 ** attempt + Math.random() * 300,
      ),
    );
  }
  throw new Error("Source retry limit reached");
};
export async function fetchOfficial(
  url: URL,
  options: RequestInit = {},
): Promise<unknown> {
  return (await fetchOfficialResponse(url, options)).body;
}
/** Some services answer 404 for a search with no matches. That is an empty result, not an outage. */
export async function orEmptyOn404<T>(work: Promise<T>, empty: T): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof SourceHttpError && error.status === 404) return empty;
    throw error;
  }
}
