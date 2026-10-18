"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { login, logout } from "@/lib/auth";
export async function signIn(form: FormData) {
  let ok = false;
  try {
    const email = z.string().trim().min(3).max(200).parse(form.get("email"));
    const password = z.string().min(1).max(300).parse(form.get("password"));
    ok = await login(email, password);
  } catch {
    redirect(
      "/login?error=Sign-in+failed.+Check+credentials+or+try+again+later.",
    );
  }
  if (!ok) redirect("/login?error=Invalid+email+or+password");
  redirect("/admin");
}
export async function signOut() {
  await logout();
  redirect("/");
}
