import { digits, type TextLine } from "./layout";

/** Numbered sections often use a separate font for their marker, while options
 * use the body font. Require repeated evidence; never apply this to OCR. */
export function schoolRows(rows: TextLine[][], width: number): TextLine[][] {
  const ordered = rows
    .map((row) => [...row].sort((a, b) => b.x - a.x))
    .sort((a, b) => a[0].y - b[0].y);
  const candidates: { line: TextLine; number: number }[] = [];
  for (const row of ordered)
    for (let i = 0; i < row.length - 2; i++) {
      const marker = row[i],
        separator = row[i + 1];
      if (
        !marker.fontId ||
        !/^\d{1,3}$/.test(digits(marker.text.trim())) ||
        !/^[()]$/.test(separator.text.trim()) ||
        marker.fontId !== separator.fontId ||
        marker.x - separator.x - separator.width > marker.height * 0.5
      )
        continue;
      const body = row
        .slice(i + 2)
        .find((l) => /[\u0600-\u06ffA-Za-z]/.test(l.text));
      if (!body || body.fontId === marker.fontId) continue;
      candidates.push({ line: marker, number: Number(digits(marker.text)) });
    }
  const fonts = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const key = candidate.line.fontId!;
    fonts.set(key, [...(fonts.get(key) ?? []), candidate]);
  }
  const headings = [...fonts.values()].filter(
    (items) =>
      new Set(items.map((c) => c.number)).size >= 3 &&
      items.some((c) => c.number > 4),
  );
  if (headings.length !== 1) return rows;
  for (const candidate of headings[0])
    candidate.line.questionNumber = candidate.number;
  const result: TextLine[][] = [];
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i],
      markers = row.filter((l) => l.questionNumber !== undefined);
    // A local two-column section can precede full-width questions on the same page.
    if (
      markers.length === 2 &&
      markers.some((l) => l.x > width * 0.65) &&
      markers.some((l) => l.x < width * 0.55)
    ) {
      const band: TextLine[][] = [row];
      while (
        i + 1 < ordered.length &&
        !ordered[i + 1].some((l) => l.questionNumber !== undefined)
      )
        band.push(ordered[++i]);
      for (const right of [true, false])
        for (const line of band) {
          const fragments = line
            .filter((l) => (right ? l.x >= width / 2 : l.x < width / 2))
            .map((l) => ({
              ...l,
              columnBounds: { x: right ? width / 2 : 0, width: width / 2 },
            }));
          if (fragments.length) result.push(fragments);
        }
    } else result.push(row);
  }
  return result;
}
