import type { TextLine } from "./layout";
/** Preserve fragments before same-baseline joining, only with repeated headings on both sides. */
export function splitColumnRows(
  rows: TextLine[][],
  width: number,
): TextLine[][] {
  const middle = width / 2;
  const headings = rows
    .flat()
    .filter((l) =>
      /^\s*(?:(?:سؤال|پرسش|question)\s*)?[0-9۰-۹٠-٩]{1,3}\s*[-.،:]/i.test(
        l.text,
      ),
    );
  const left = headings.filter((l) => l.x + l.width <= middle),
    right = headings.filter((l) => l.x >= middle);
  if (left.length < 2 || right.length < 2) return rows;
  return rows.flatMap((row) => {
    const crossing = row.filter((l) => l.x < middle && l.x + l.width > middle);
    return [
      crossing,
      row.filter((l) => l.x + l.width <= middle),
      row.filter((l) => l.x >= middle),
    ].filter((group) => group.length);
  });
}
