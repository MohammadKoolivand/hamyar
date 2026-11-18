import katex from "katex";
import { normalizePersianQuestionText } from "./persian-question-text";
import { toPersianDigits } from "./presentation";
export function questionDisplayText(text: string) {
  // The bundled print font mis-shapes combining hamza above final heh.
  // Use the explicit Persian ezafe spelling for display, preserving stored text.
  // Localize prose only: URLs and inline LaTeX are source, not visible prose.
  return normalizePersianQuestionText(text)
    .replace(/هٔ|ۀ/g, "ه‌ی")
    .split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|https?:\/\/[^\s<>]+)/g)
    .map((part, i) => (i % 2 ? part : toPersianDigits(part)))
    .join("");
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
  // KaTeX must parse ASCII, but visible MathML numerals and HTML number
  // glyphs should always be Persian, regardless of the source digit script.
  // Never rewrite markup attributes, SVG coordinates or LaTeX annotations.
  const localized = markup.replace(
    /(<mn\b[^>]*>)([^<]*)(<\/mn>)/g,
    (_match, open: string, value: string, close: string) =>
      open + toPersianDigits(value) + close,
  );
  return localized.replace(
    /(<span\b[^>]*>)([0-9٠-٩۰-۹.]+)(<\/span>)/g,
    (_match, open: string, value: string, close: string) =>
      open + '<span class="hy-math-number">' + toPersianDigits(value) + "</span>" + close,
  );
}
