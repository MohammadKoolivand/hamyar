// Formatting is stored as a narrow text marker, never interpreted as arbitrary HTML.
export function toggleQuestionUnderline(
  text: string,
  start: number,
  end: number,
) {
  if (start < 0 || end > text.length || start >= end) return null;
  const selected = text.slice(start, end);
  if (
    text.slice(start - 3, start) === "<u>" &&
    text.slice(end, end + 4) === "</u>"
  ) {
    return {
      text: text.slice(0, start - 3) + selected + text.slice(end + 4),
      start: start - 3,
      end: end - 3,
    };
  }
  if (selected.startsWith("<u>") && selected.endsWith("</u>")) {
    return {
      text: text.slice(0, start) + selected.slice(3, -4) + text.slice(end),
      start,
      end: end - 7,
    };
  }
  return {
    text: text.slice(0, start) + "<u>" + selected + "</u>" + text.slice(end),
    start: start + 3,
    end: end + 3,
  };
}
