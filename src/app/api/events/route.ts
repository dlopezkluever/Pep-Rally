import { z } from "zod";
import { transaction } from "@/lib/db";
import { verifyOrigin, rateLimit } from "@/lib/auth";
const event = z
  .object({
    event: z.enum([
      "page_view",
      "zero_result",
      "citation_click",
      "comparison_view",
      "area_view",
      "search",
    ]),
    audience: z.enum(["women", "50plus"]),
  })
  .strict();
export async function POST(request: Request) {
  try {
    await verifyOrigin();
    if (Number(request.headers.get("content-length") ?? 0) > 1024)
      return new Response(null, { status: 413 });
    await rateLimit("analytics:global", 1000, 60);
    const bytes = await request.text();
    if (bytes.length > 1024) return new Response(null, { status: 413 });
    const input = event.parse(JSON.parse(bytes));
    await transaction(null, (c) =>
      c.query(
        "INSERT INTO wiki.analytics_daily(event,audience) VALUES($1,$2) ON CONFLICT(day,event,audience) DO UPDATE SET count=analytics_daily.count+1",
        [input.event, input.audience],
      ),
    );
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
