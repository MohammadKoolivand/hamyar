/** Keep image-only choices compatible with the non-empty option schema. */
export function normalizeImageOnlyChoices<
  T extends { options: string[]; optionImages?: (unknown | null)[]; reference: string },
>(question: T): T {
  const options = question.options.map((option, index) =>
    !option.trim() && question.optionImages?.[index]
      ? `تصویر گزینه ${index + 1}`
      : option,
  );
  const imageOnlyIndices = question.options.flatMap((option, index) =>
    !option.trim() && question.optionImages?.[index] ? [index] : [],
  );
  const reference =
    !question.reference.trim() && imageOnlyIndices.length === 1
      ? options[imageOnlyIndices[0]]
      : question.reference;
  return { ...question, options, reference };
}
