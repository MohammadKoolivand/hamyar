/** Shared, host-only session cookie for password and phone OTP login. */
export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    // Never allow a deployment flag to disable Secure in production.
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    path: "/" as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return { path: "/" as const, httpOnly: true as const,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true" };
}
