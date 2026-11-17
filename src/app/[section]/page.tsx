import { notFound, redirect } from "next/navigation";
import HamyarApp from "@/components/hamyar-app";
import { routeSegments } from "@/lib/app-routes";

// Reopen only authenticated authoring entrypoints. The rest of the MVP
// remains on its deliberately limited public-home navigation.
const educatorEntries = new Set(["exam-import", "login"]);
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
  if (educatorEntries.has(section)) return <HamyarApp />;
  redirect("/");
}
