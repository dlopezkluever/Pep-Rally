import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://127.0.0.1:3048"),
  title: {
    default: "Peppy Tides | A clearer view of peptide research",
    template: "%s | Peppy Tides",
  },
  description:
    "Understand peptide research, evidence, safety, and uncertainty. Follow the original science.",
  openGraph: {
    type: "website",
    siteName: "Peppy Tides",
    title: "Peppy Tides",
    description: "Research, in perspective.",
  },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Script nonces are minted per request in src/proxy.ts, so no page may be prerendered.
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
