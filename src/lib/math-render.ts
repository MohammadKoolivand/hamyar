import katex from "katex";
import { normalizePersianQuestionText } from "./persian-question-text";
export function questionDisplayText(text: string) {
  // The bundled print font mis-shapes combining hamza above final heh.
  // Use the explicit Persian ezafe spelling for display, preserving stored text.
  return normalizePersianQuestionText(text).replace(/هٔ|ۀ/g, "ه‌ی");
}
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
  const needsFullSize = /\\(?:sqrt|begin\s*\{(?:[pbBvV]?matrix|array|cases|aligned|gathered)\})/.test(parsable);
  const markup = katex.renderToString(
    needsFullSize && !displayMode ? "\\displaystyle " + parsable : parsable,
    {
      // KaTeX HTML gives matrices predictable row and column spacing across browsers.
      output: "htmlAndMathml",
      displayMode,
      throwOnError: true,
      trust: false,
      strict: "error",
      maxExpand: 100,
      maxSize: 10,
      macros: {},
    },
  );
  const localized = /[۰-۹]/.test(latex)
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
  if (!/[۰-۹]/.test(latex)) return localized;
  // Localize only HTML text nodes: SVG path coordinates must remain untouched.
  return localized.replace(
    /(<span\b[^>]*>)([0-9.]+)(<\/span>)/g,
    (_match, open, value, close) =>
      open +
      '<span class="hy-math-number">' +
      value.replace(/[0-9]/g, (digit: string) =>
        String.fromCharCode(0x06f0 + Number(digit)),
      ) +
      "</span>" +
      close,
  );
}
