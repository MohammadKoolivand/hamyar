import { notFound } from "next/navigation";
import HamyarApp from "@/components/hamyar-app";
import { routeSegments } from "@/lib/app-routes";

// Give every tab a real Next.js route (deep links and hard refresh work).
export function generateStaticParams() {
  return routeSegments.map((section) => ({ section }));
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!routeSegments.some((segment) => segment === section)) notFound();
  return <HamyarApp />;
}
