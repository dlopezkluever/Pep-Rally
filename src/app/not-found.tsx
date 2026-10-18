import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">Profile unavailable</p>
      <h1>This page is not in the published library.</h1>
      <p>
        It may still be under review, or its publication may have been
        withdrawn.
      </p>
      <Link className="button" href="/women/browse">
        Explore the library
      </Link>
    </main>
  );
}
