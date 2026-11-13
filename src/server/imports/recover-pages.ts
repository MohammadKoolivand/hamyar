import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
} from "pdf-lib";

/** Flatten only resolvable original page references. Never infer the size of
 * a broken subtree: its missing pages cannot safely be numbered. */
export async function recoverPageReferences(bytes: Buffer, total: number) {
  const source = await PDFDocument.load(bytes, {
    throwOnInvalidObject: false,
    updateMetadata: false,
  });
  const root = source.catalog.Pages(),
    rootRef = source.catalog.get(PDFName.of("Pages"));
  const entries: { page: number; ref: PDFRef; dict: PDFDict }[] = [],
    failed: number[] = [],
    seen = new Set<string>();
  let number = 0;
  function walk(node: PDFDict, depth: number) {
    if (depth > 20) throw new Error("Invalid PDF page tree depth");
    const kids = node.lookup(PDFName.of("Kids"), PDFArray);
    const count = node.lookup(PDFName.of("Count"), PDFNumber).asNumber();
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw new Error("Invalid PDF page count");
    const start = number;
    for (const ref of kids.asArray()) {
      if (!(ref instanceof PDFRef) || seen.has(ref.toString()))
        throw new Error("Invalid PDF page reference");
      seen.add(ref.toString());
      const child = source.context.lookup(ref);
      if (
        child instanceof PDFDict &&
        child.get(PDFName.of("Type")) === PDFName.of("Pages")
      )
        walk(child, depth + 1);
      else if (
        child instanceof PDFDict &&
        child.get(PDFName.of("Type")) === PDFName.of("Page")
      )
        entries.push({ page: ++number, ref, dict: child });
      else {
        if (count !== kids.size())
          throw new Error("Cannot safely number damaged PDF subtree");
        failed.push(++number);
      }
    }
    if (number - start !== count) throw new Error("PDF page count mismatch");
  }
  walk(root, 0);
  if (number !== total || !entries.length)
    throw new Error("PDF has no safely recoverable pages");
  root.set(PDFName.of("Kids"), source.context.obj(entries.map((e) => e.ref)));
  root.set(PDFName.of("Count"), PDFNumber.of(entries.length));
  for (const entry of entries) entry.dict.set(PDFName.of("Parent"), rootRef!);
  return { source, entries, failed };
}
