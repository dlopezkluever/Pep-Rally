import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "./actions";
export const metadata: Metadata = {
  title: "Researcher sign in",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-wrap">
      <Link href="/" className="wordmark">
        peppy tides<span>Research, in perspective.</span>
      </Link>
      <section className="panel">
        <p className="eyebrow">Editorial workspace</p>
        <h1>Welcome back.</h1>
        <p>Sign in to research, review, and maintain the library.</p>
        {error && (
          <p role="alert" className="notice danger">
            {error}
          </p>
        )}
        <form action={signIn} className="stack">
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button>Sign in</button>
        </form>
        <p className="small">
          Access is limited to assigned researchers and editors.
        </p>
      </section>
    </main>
  );
}
