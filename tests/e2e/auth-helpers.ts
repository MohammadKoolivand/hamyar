import { randomInt } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Most browser tests exercise curriculum/workflows, not the OTP gateway.
// Bootstrap a synthetic, phone-identified account using the retained internal
// credentials API, then exercise the real UI with its real session cookie.
// Public phone-OTP signup/login is covered separately in phone-otp.spec.ts.
export const fixturePassword = "StrongPass123!";
export function syntheticPhone() {
  return "09" + String(randomInt(100000000, 1000000000));
}
export async function registerSyntheticUser(
  page: Page,
  name: string,
  role: "teacher" | "student" = "teacher",
  phone = syntheticPhone(),
  password = fixturePassword,
): Promise<string> {
  const created = await page.request.post("/api/auth/register", {
    data: { name, email: phone, password, role },
  });
  expect(created.status(), await created.text()).toBe(200);
  await loginSyntheticUser(page, phone, password);
  return phone;
}
export async function loginSyntheticUser(
  page: Page,
  phone: string,
  password = fixturePassword,
): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email: phone, password },
  });
  expect(response.status(), await response.text()).toBe(200);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "خروج", exact: true })).toBeVisible({ timeout: 15000 });
}
export async function useFixtureSession(page: Page, cookie: string) {
  const [name, ...value] = cookie.split("=");
  if (name !== "session" || !value.length) throw new Error("Invalid test fixture cookie");
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
  await page.context().addCookies([{
    name, value: value.join("="), url: new URL(baseURL).origin,
    httpOnly: true, sameSite: "Strict",
  }]);
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "خروج", exact: true })).toBeVisible();
}
