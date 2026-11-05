export type StudentContentKind = "questions" | "exams" | "resources";

export interface StudentContentFilters {
  grade: string;
  track: string;
  book: string;
  chapter: string;
  topic: string;
  content: StudentContentKind;
  query: string;
  sort: "relevant" | "newest" | "hardest" | "easiest";
}

export const emptyStudentContentFilters: StudentContentFilters = {
  grade: "",
  track: "",
  book: "",
  chapter: "",
  topic: "",
  content: "questions",
  query: "",
  sort: "relevant",
};

export function parseStudentContentFilters(
  search: string,
): StudentContentFilters {
  const params = new URLSearchParams(search);
  const content = params.get("content");

  return {
    query: (params.get("q") ?? "").slice(0, 120),
    sort: ["newest", "hardest", "easiest"].includes(params.get("sort") ?? "") ? params.get("sort") as StudentContentFilters["sort"] : "relevant",
    grade: params.get("grade") ?? "",
    track: params.get("track") ?? "",
    book: params.get("book") ?? "",
    chapter: params.get("chapter") ?? "",
    topic: params.get("topic") ?? "",
    content:
      content === "exams" || content === "resources" ? content : "questions",
  };
}

export function studentContentPath(filters: StudentContentFilters): string {
  const params = new URLSearchParams();

  for (const key of ["grade", "track", "book", "chapter", "topic"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  params.set("content", filters.content);
  if (filters.query) params.set("q", filters.query);
  if (filters.sort !== "relevant") params.set("sort", filters.sort);

  return `/search?${params.toString()}`;
}
