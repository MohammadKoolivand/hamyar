import assert from "node:assert/strict";
import test from "node:test";
import {
  bankDifficulty,
  bankExamKey,
  bankFilterSearch,
  emptyBankFilters,
  matchesBankQuestion,
  parseBankFilters,
  type PublicBankQuestion,
} from "../../src/lib/public-bank";
const question: PublicBankQuestion = {
  _id: "q1",
  statement: "سؤال $x^2$",
  options: ["۱", "۲"],
  type: "choice",
  taxonomy: {
    level: "متوسطه دوم",
    grade: "دوازدهم",
    book: "ریاضی",
    chapter: "تابع",
    topic: "دامنه",
  },
  difficultyScore: 40,
  year: 1405,
  source: {
    family: "konkur",
    group: "mathematics",
    location: "domestic",
    session: "اول",
  },
};
test("hierarchical filters and category-dependent source fields survive a direct URL", () => {
  const filters = {
    ...emptyBankFilters(),
    ...question.taxonomy,
    category: "konkur",
    difficulty: "medium",
    content: "exams",
    extra: { group: "mathematics", location: "domestic", year: "1405" },
  };
  assert.deepEqual(parseBankFilters(`?${bankFilterSearch(filters)}`), filters);
  assert.equal(matchesBankQuestion(question, filters), true);
  assert.equal(
    matchesBankQuestion(question, { ...filters, book: "شیمی" }),
    false,
  );
  assert.equal(
    matchesBankQuestion(question, {
      ...filters,
      extra: { location: "international" },
    }),
    false,
  );
  assert.equal(
    parseBankFilters(
      "?category=final&source_group=mathematics&source_session=خرداد",
    ).extra.group,
    undefined,
  );
});
test("difficulty boundaries and unset scores never invent a difficulty", () => {
  for (const [score, expected] of [
    [0, "easy"],
    [33, "easy"],
    [34, "medium"],
    [66, "medium"],
    [67, "hard"],
    [100, "hard"],
  ] as const)
    assert.equal(
      bankDifficulty({ ...question, difficultyScore: score }),
      expected,
    );
  assert.equal(
    bankDifficulty({
      ...question,
      difficultyScore: undefined,
      difficulty: undefined,
    }),
    "unset",
  );
});
test("exam grouping separates locations and sessions and excludes authored exercises", () => {
  assert.notEqual(
    bankExamKey(question),
    bankExamKey({
      ...question,
      source: { ...question.source!, location: "international" },
    }),
  );
  assert.notEqual(
    bankExamKey(question),
    bankExamKey({
      ...question,
      source: { ...question.source!, session: "دوم" },
    }),
  );
  assert.equal(
    bankExamKey({
      ...question,
      source: { family: "practice", practice: "teacher" },
    }),
    "",
  );
});
