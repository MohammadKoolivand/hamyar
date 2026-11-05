export type StudentContentKind = "questions" | "exams" | "resources";

export interface StudentContentFilters {
  grade: string;
  track: string;
  book: string;
  chapter: string;
  topic: string;
  content: StudentContentKind;
}

export const emptyStudentContentFilters: StudentContentFilters = {
  grade: "",
  track: "",
  book: "",
  chapter: "",
  topic: "",
  content: "questions",
};

export function parseStudentContentFilters(
  search: string,
): StudentContentFilters {
  const params = new URLSearchParams(search);
  const content = params.get("content");

  return {
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

  return `/search?${params.toString()}`;
}
