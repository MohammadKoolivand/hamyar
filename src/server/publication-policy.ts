/** The question bank is public-only. Answer references remain server-side and are
 * never included in the public catalog response.
 */
export function visibilityForAuthoredQuestion(
  _requested: "private" | "public" | undefined,
  _previous: "private" | "public" = "public",
  _environment = process.env.NODE_ENV,
): "public" {
  return "public";
}
