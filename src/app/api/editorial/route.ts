import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireActor, verifyOrigin, rateLimit } from "@/lib/auth";
import { mutate } from "@/lib/editorial";
import { extractDraft } from "@/lib/research";
import { z } from "zod";
export async function POST(request: Request) {
  const actor = await requireActor();
  try {
    await verifyOrigin();
    await rateLimit(`editorial:${actor.id}`, 120, 60);
    const form = await request.formData();
    const data = Object.fromEntries(form.entries());
    const operation = String(data.operation ?? "");
    if (operation === "extract") {
      const input = z
        .object({ revisionId: z.uuid(), observationId: z.uuid() })
        .parse(data);
      await extractDraft({ ...input, actorId: actor.id });
    } else await mutate(actor, operation, data);
    revalidatePath("/", "layout");
    return NextResponse.redirect(
      new URL("/admin?success=Saved", process.env.SITE_URL),
      303,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed";
    return NextResponse.redirect(
      new URL(
        `/admin?error=${encodeURIComponent(message.slice(0, 350))}`,
        process.env.SITE_URL,
      ),
      303,
    );
  }
}
