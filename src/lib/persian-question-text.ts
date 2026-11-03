const persianWord = "آأإءؤئابپتثجچحخدذرزژسشصضطظعغفقکكگلمنوهیيىۀة";
const suffix = "ها(?:ی(?:ی|م|ت|ش|مان|تان|شان)?)?";
// These words end in ها but are not plural suffixes (including their ی forms).
const nonPlural =
  /^(?:تنها|رها|بها|انتها|منتها|اژدها|اشتها|گرانبها|پربها|کمبها)(?:ی(?:ی|م|ت|ش|مان|تان|شان)?)?$/;
function spacePluralSuffixes(text: string) {
  return text
    .replace(new RegExp(`[${persianWord}]+`, "g"), (word) => {
      if (nonPlural.test(word)) return word;
      const match = word.match(new RegExp(`^(.{2,}?)(${suffix})$`));
      return match ? `${match[1]}\u200c${match[2]}` : word;
    })
    .replace(
      new RegExp(
        `([${persianWord}]+)[ \t]+(${suffix})(?![${persianWord}])`,
        "g",
      ),
      "$1\u200c$2",
    );
}

/** Canonical Persian prose; mathematical source and URLs are kept verbatim. */
export function normalizePersianQuestionText(text: string): string {
  return text
    .split(
      /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|https?:\/\/[^\s<>]+)/g,
    )
    .map((part, index) =>
      index % 2
        ? part
        : spacePluralSuffixes(
            part.replace(/[يى]/g, "ی").replace(/ة/g, "ه").replace(/ۀ/g, "هٔ"),
          ),
    )
    .join("");
}

export function normalizeQuestionTextFields<
  T extends {
    statement?: string;
    reference?: string;
    options?: string[];
    hints?: string[];
  },
>(question: T): T {
  return {
    ...question,
    ...(question.statement !== undefined
      ? { statement: normalizePersianQuestionText(question.statement) }
      : {}),
    ...(question.reference !== undefined
      ? { reference: normalizePersianQuestionText(question.reference) }
      : {}),
    ...(question.options
      ? { options: question.options.map(normalizePersianQuestionText) }
      : {}),
    ...(question.hints
      ? { hints: question.hints.map(normalizePersianQuestionText) }
      : {}),
  };
}
