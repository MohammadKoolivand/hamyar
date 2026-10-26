/** Read-only startup configuration guard. Never prints environment values. */
import process from "node:process";
import console from "node:console";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";

const key32 = (value) => {
  const key = Buffer.from(value ?? "", "base64");
  return key.length === 32 && key.toString("base64") === value;
};
export function deploymentChecks(env, role = "web") {
  const errors = [],
    warnings = [];
  if (!["web", "exams", "mail"].includes(role))
    errors.push("SERVICE_ROLE_INVALID");
  if (!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(env.MONGO_URL ?? ""))
    errors.push("MONGO_URL_REQUIRED_OR_INVALID");
  if (
    !/^[-\w]+$/.test(env.MONGO_DB ?? "") ||
    Buffer.byteLength(env.MONGO_DB ?? "") > 63
  )
    errors.push("MONGO_DB_REQUIRED_OR_INVALID");
  if (!env.HODHOD_EXPECTED_DB || env.HODHOD_EXPECTED_DB !== env.MONGO_DB)
    errors.push("EXPECTED_DATABASE_MISMATCH");
  try {
    const origin = new URL(env.APP_ORIGIN);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/"
    )
      errors.push("APP_ORIGIN_REQUIRES_HTTPS_ORIGIN");
  } catch {
    errors.push("APP_ORIGIN_REQUIRES_HTTPS_ORIGIN");
  }
  if (env.COOKIE_SECURE !== "true") errors.push("SECURE_COOKIES_REQUIRED");
  if (role === "web") {
    if (!["mock", "ollama"].includes(env.AI_PROVIDER ?? "mock"))
      errors.push("AI_PROVIDER_INVALID");
    const sms =
      env.MELIPAYAMAK_USERNAME &&
      env.MELIPAYAMAK_PASSWORD &&
      /^\d+$/.test(env.MELIPAYAMAK_OTP_BODY_ID ?? "");
    if (!sms) warnings.push("REAL_SMS_NOT_CONFIGURED");
    else if (!key32(env.AUTH_OTP_SECRET)) errors.push("OTP_SECRET_INVALID");
  }
  if (role === "mail") {
    if (!env.SMTP_HOST || /[\s/]/.test(env.SMTP_HOST))
      errors.push("SMTP_HOST_REQUIRED_OR_INVALID");
    if (!env.SMTP_USER || !env.SMTP_PASSWORD)
      errors.push("SMTP_CREDENTIALS_REQUIRED");
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.SMTP_FROM ?? ""))
      errors.push("SMTP_FROM_REQUIRED_OR_INVALID");
    const port = Number(env.SMTP_PORT ?? "465");
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      errors.push("SMTP_PORT_INVALID");
    if (!key32(env.MAIL_OUTBOX_KEY)) errors.push("MAIL_OUTBOX_KEY_INVALID");
  }
  return { errors, warnings };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const role = process.argv[2] ?? "web";
  const result = deploymentChecks(process.env, role);
  if (Number(process.versions.node.split(".")[0]) < 22)
    result.errors.push("NODE_22_REQUIRED");
  if (role === "web" && !existsSync(".next/BUILD_ID"))
    result.errors.push("PRODUCTION_BUILD_MISSING");
  console.log(
    JSON.stringify({
      scope: "configuration_only_not_remote_readiness",
      role,
      status: result.errors.length ? "NEEDS CONFIGURATION" : "READY",
      ...result,
    }),
  );
  process.exitCode = result.errors.length ? 1 : 0;
}
