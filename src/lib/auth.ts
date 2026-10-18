import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transaction, value } from "./db";
import { actorSchema, type Actor } from "./domain";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get("peppy_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return value(
    "SELECT (SELECT to_jsonb(a) FROM wiki.auth_session($1) a) AS data",
    [hash(token)],
    actorSchema.nullable(),
  );
}
export async function requireActor(
  roles: Actor["role"][] = ["researcher", "editor", "admin"],
) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!roles.includes(actor.role))
    throw new Error("Your role cannot perform this operation");
  return actor;
}
export async function verifyOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!process.env.SITE_URL || origin !== new URL(process.env.SITE_URL).origin)
    throw new Error("Request origin rejected");
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  return transaction(null, async (c) => {
    const r = await c.query(
      "INSERT INTO wiki.rate_bucket(key,hits,reset_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_bucket.reset_at<now() THEN 1 ELSE rate_bucket.hits+1 END,reset_at=CASE WHEN rate_bucket.reset_at<now() THEN now()+$2*interval '1 second' ELSE rate_bucket.reset_at END RETURNING hits",
      [hash(key), seconds],
    );
    if (z.object({ hits: z.number() }).parse(r.rows[0]).hits > limit)
      throw new Error("Too many attempts. Try again later.");
  });
}
export async function login(email: string, password: string) {
  await verifyOrigin();
  await rateLimit(`login:${email.toLowerCase()}`, 8, 900);
  await rateLimit("login:global", 120, 900);
  const credential = await value(
    "SELECT (SELECT to_jsonb(a) FROM wiki.auth_credentials($1) a) AS data",
    [email.toLowerCase()],
    z
      .object({
        id: z.uuid(),
        password_hash: z.string(),
        disabled: z.boolean(),
      })
      .nullable(),
  );
  const [salt, expected] = credential?.password_hash.split(":") ?? [
    "invalid",
    "00".repeat(64),
  ];
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  if (
    !credential ||
    credential.disabled ||
    target.length !== actual.length ||
    !timingSafeEqual(target, actual)
  )
    return false;
  const token = randomBytes(32).toString("hex");
  await value(
    "SELECT wiki.auth_create_session($1,$2) AS data",
    [credential.id, hash(token)],
    z.unknown(),
  );
  (await cookies()).set("peppy_session", token, {
    httpOnly: true,
    secure:
      new URL(process.env.SITE_URL ?? "http://localhost").protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 28800,
  });
  return true;
}
export async function logout() {
  await verifyOrigin();
  const jar = await cookies();
  const token = jar.get("peppy_session")?.value;
  if (token)
    await value(
      "SELECT wiki.auth_delete_session($1) AS data",
      [hash(token)],
      z.unknown(),
    );
  jar.delete("peppy_session");
}
