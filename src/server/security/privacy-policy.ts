/** Fail closed for student processing on production deployments. Until a market-specific
 * legal policy is approved, require guardian consent for every student account.
 * DOB and teacher invitations are NOT proof of legal age or guardianship. */
export function studentConsentRequired(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" || env.STUDENT_CONSENT_REQUIRED === "true";
}
export function consentPolicyVersion(env: NodeJS.ProcessEnv = process.env) {
  const value = env.STUDENT_CONSENT_POLICY_VERSION ?? "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(value))
    throw new Error("STUDENT_CONSENT_POLICY_VERSION must name a reviewed policy");
  return value;
}
export const CONSENT_SCOPE = "educational-processing:v1";

function valueOf(value: object | null | undefined, key: string): unknown {
  return value ? (value as Record<string, unknown>)[key] : undefined;
}

export function isValidGuardianConsent(
  link: object | null,
  consent: object | null,
  guardianId: string,
  studentId: string,
  version: string,
) {
  return valueOf(link, "status") === "verified" && typeof valueOf(link, "verifiedAt") === "string" &&
    valueOf(consent, "status") === "granted" && valueOf(consent, "guardianId") === guardianId &&
    valueOf(consent, "studentId") === studentId && valueOf(consent, "scope") === CONSENT_SCOPE &&
    valueOf(consent, "policyVersion") === version;
}

/** A student-wide withdrawal overrides otherwise valid guardian grants until
 * a new, verified grant explicitly resumes processing. */
export function consentProcessingSuspended(student: object | null) {
  return !student || valueOf(student, "consentProcessingSuspended") === true;
}
