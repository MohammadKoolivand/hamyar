import katex from "katex";
export function mathMarkup(latex: string, displayMode = true) {
  if (
    latex.length > 1000 ||
    /\\(?:html\w*|includegraphics|href|url|def|gdef|edef|xdef|newcommand|renewcommand|let|global)\b/i.test(
      latex,
    )
  )
    throw new Error("فرمول پشتیبانی نمی‌شود");
  return katex.renderToString(latex, {
    output: "mathml",
    displayMode,
    throwOnError: true,
    trust: false,
    strict: "error",
    maxExpand: 100,
    maxSize: 10,
    macros: {},
  });
}
