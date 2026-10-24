export const tabPaths = {
  dashboard: "/dashboard",
  students: "/students",
  courses: "/courses",
  classes: "/classes",
  content: "/content",
  missions: "/homeworks",
  learning: "/learning",
} as const;

export type TabPage = keyof typeof tabPaths;
export type AppPage = TabPage | "practice" | "report";

export const routeSegments = [
  ...Object.values(tabPaths).map((path) => path.slice(1)),
  "practice",
  "report",
] as const;

const tabEntries = Object.entries(tabPaths) as [TabPage, string][];

export function pageFromPath(pathname: string): AppPage {
  if (pathname === "/practice") return "practice";
  if (pathname === "/report") return "report";
  return tabEntries.find(([, path]) => path === pathname)?.[0] ?? "dashboard";
}

export function pathForPage(page: string, assignmentId?: string): string {
  if (page === "practice" || page === "report") {
    return assignmentId
      ? `/${page}?assignment=${encodeURIComponent(assignmentId)}`
      : "/homeworks";
  }
  return tabPaths[page as TabPage] ?? "/dashboard";
}

export function assignmentFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("assignment");
  return id && /^[a-f0-9-]{36}$/i.test(id) ? id : null;
}
