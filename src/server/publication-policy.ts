/** Preserve existing legacy behavior in test/dev, but fail closed in production.
 * Only the admin review transaction may publish a new public version.
 */
export function visibilityForAuthoredQuestion(
  requested: "private" | "public" | undefined,
  previous: "private" | "public" = "public",
  environment = process.env.NODE_ENV,
): "private" | "public" {
  return environment === "production" ? "private" : (requested ?? previous);
}
