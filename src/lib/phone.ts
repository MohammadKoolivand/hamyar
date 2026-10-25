import { z } from "zod";

export function normalizePhone(value: string): string {
  const digits = value
    .trim()
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[\s()-]/g, "");
  return digits.replace(/^(\+98|0098)/, "0");
}
export const phoneSchema = z
  .string()
  .max(40)
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .regex(
        /^09\d{9}$/,
        "شماره موبایل معتبر ایران وارد کنید؛ مانند 09123456789",
      ),
  );
// Email is retained only for existing API clients and outstanding legacy invitations.
export const invitationContactSchema = z
  .object({
    phone: phoneSchema.optional(),
    email: z
      .email()
      .transform((s) => s.toLowerCase())
      .optional(),
  })
  .refine(
    (b) => Boolean(b.phone) !== Boolean(b.email),
    "فقط یک شماره موبایل وارد کنید",
  );
export const loginIdentifierSchema = z.union([
  z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  phoneSchema,
]);
export function accountContact(identifier: string) {
  return identifier.includes("@")
    ? { email: identifier }
    : { phone: identifier };
}
