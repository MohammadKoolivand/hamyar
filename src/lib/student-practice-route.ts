/** URL state for the student's assigned-practice catalogue. */
export interface PracticeFilters {
  query: string;
  kind: string;
  status: string;
  course: string;
  chapter: string;
  topic: string;
  year: string;
  difficulty: string;
  minDifficulty: number;
  maxDifficulty: number;
  sort: string;
}

export const defaultPracticeFilters: PracticeFilters = {
  query: "", kind: "all", status: "all", course: "all", chapter: "all",
  topic: "all", year: "all", difficulty: "all", minDifficulty: 0,
  maxDifficulty: 100, sort: "priority",
};

const options: Record<string, readonly string[]> = {
  kind: ["all", "topic", "chapter", "school", "final", "konkur", "mistakes", "smart"],
  status: ["all", "ready", "completed"],
  difficulty: ["all", "unset", "easy", "medium", "hard"],
  sort: ["priority", "questions", "hardest", "easiest", "success"],
};

function bound(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

export function parsePracticeFilters(search: string): PracticeFilters {
  const params = new URLSearchParams(search);
  const selected = (name: keyof PracticeFilters) => params.get(name) ?? "";
  const choice = (name: "kind" | "status" | "difficulty" | "sort") =>
    options[name].includes(selected(name)) ? selected(name) : defaultPracticeFilters[name];
  const minDifficulty = bound(params.get("minDifficulty"), 0);
  const maxDifficulty = Math.max(minDifficulty, bound(params.get("maxDifficulty"), 100));
  return {
    query: selected("query").slice(0, 200),
    kind: choice("kind"), status: choice("status"),
    course: selected("course") || "all", chapter: selected("chapter") || "all",
    topic: selected("topic") || "all", year: selected("year") || "all",
    difficulty: choice("difficulty"), minDifficulty, maxDifficulty,
    sort: choice("sort"),
  };
}

export function practiceFiltersPath(filters: PracticeFilters): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(defaultPracticeFilters) as (keyof PracticeFilters)[]) {
    if (filters[key] !== defaultPracticeFilters[key]) params.set(key, String(filters[key]));
  }
  const query = params.toString();
  return `/student-practice${query ? `?${query}` : ""}`;
}
