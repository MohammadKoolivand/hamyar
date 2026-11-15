export type PdfTaxonomy = {
  level: string;
  grade: string;
  book: string;
  chapter: string;
  topic: string;
};

export interface PdfLibraryItem {
  _id: string;
  title: string;
  description: string;
  taxonomy: PdfTaxonomy;
  visibility: "public" | "private";
  state: "pending" | "ready";
  createdAt: string;
  file?: { name: string; size: number; sha256: string };
  topicId?: string;
}

export const pdfTaxonomyKeys = ["level", "grade", "book", "chapter", "topic"] as const;

export function matchesPdfTaxonomy(
  item: PdfLibraryItem,
  selected: Partial<PdfTaxonomy>,
) {
  return pdfTaxonomyKeys.every((key) => !selected[key] ||
    item.taxonomy[key] === selected[key]);
}

export function formatPdfTaxonomy(item: PdfLibraryItem) {
  return pdfTaxonomyKeys.map((key) => item.taxonomy[key]).filter(Boolean).join(" · ");
}
