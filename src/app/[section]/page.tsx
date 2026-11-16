import { notFound, redirect } from "next/navigation";
// All original pages and their implementations are preserved for reactivation.
// import HamyarApp from "@/components/hamyar-app";
import { routeSegments } from "@/lib/app-routes";

// Keep known deep links recognized, but temporarily show only the public home.
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
  redirect("/");
}
