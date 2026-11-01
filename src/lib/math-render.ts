import katex from "katex";
export function mathMarkup(latex: string, displayMode = true) {
  if (
    latex.length > 1000 ||
    /\\(?:html\w*|includegraphics|href|url|def|gdef|edef|xdef|newcommand|renewcommand|let|global)\b/i.test(
      latex,
    )
  )
    throw new Error("فرمول پشتیبانی نمی‌شود");
  // KaTeX strict parsing expects ASCII numerals, while the stored source and
  // rendered MathML may use Persian numerals. Normalize only for parsing.
  const parsable = latex.replace(/[۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x06f0),
  );
  const markup = katex.renderToString(parsable, {
    output: "mathml",
    displayMode,
    throwOnError: true,
    trust: false,
    strict: "error",
    maxExpand: 100,
    maxSize: 10,
    macros: {},
  });
  return /[۰-۹]/.test(latex)
    ? markup.replace(
        /(<mn\b[^>]*>)([^<]*)(<\/mn>)/g,
        (_match, open, value, close) =>
          open +
          value.replace(/[0-9]/g, (digit: string) =>
            String.fromCharCode(0x06f0 + Number(digit)),
          ) +
          close,
      )
    : markup;
}
