import { notFound } from "next/navigation";
import { audienceSchema } from "@/lib/domain";
import { Shell } from "@/components/shell";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ audience: string }>;
}) {
  const result = audienceSchema.safeParse((await params).audience);
  if (!result.success) notFound();
  return <Shell audience={result.data}>{children}</Shell>;
}
