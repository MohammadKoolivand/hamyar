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
export function isValidGuardianConsent(
  link: { status?: unknown; verification?: unknown; verifiedAt?: unknown },
  consent: { status?: unknown; policyVersion?: unknown; scope?: unknown; guardianId?: unknown; studentId?: unknown } | null,
  guardianId: string,
  studentId: string,
  version: string,
) {
  return link.status === "verified" && typeof link.verifiedAt === "string" &&
    consent?.status === "granted" && consent.guardianId === guardianId &&
    consent.studentId === studentId && consent.scope === CONSENT_SCOPE &&
    consent.policyVersion === version;
}

/** A student-wide withdrawal overrides otherwise valid guardian grants until
 * a new, verified grant explicitly resumes processing. */
export function consentProcessingSuspended(student: { consentProcessingSuspended?: unknown } | null) {
  return !student || student.consentProcessingSuspended === true;
}
