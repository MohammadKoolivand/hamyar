import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function consentAuditKey(env = process.env) {
  const key = env.CONSENT_AUDIT_HMAC_KEY || '';
  if (env.NODE_ENV === 'production' && key.length < 32)
    throw new Error('CONSENT_AUDIT_HMAC_KEY must be configured (at least 32 characters)');
  return key || null;
}
export function consentTextFingerprint(env = process.env) {
  const digest = env.STUDENT_CONSENT_TEXT_SHA256 || '';
  if (env.NODE_ENV === 'production' && !/^[a-fA-F0-9]{64}$/.test(digest))
    throw new Error('STUDENT_CONSENT_TEXT_SHA256 must be the SHA-256 digest of the approved text');
  if (digest && !/^[a-fA-F0-9]{64}$/.test(digest)) throw new Error('Invalid consent text digest');
  return digest.toLowerCase() || null;
}
const canonical = event => JSON.stringify([
  event.consentId, event.sequence, event.guardianId, event.studentId, event.consentType,
  event.textVersion, event.textSha256, event.method, event.status, event.recordedAt,
  event.relationshipId, event.actorId, event.reason, event.previousHash,
]);
export function makeConsentEvent(values, key = consentAuditKey()) {
  const body = { ...values };
  const data = canonical(body);
  return { ...body, integrityAlgorithm: key ? 'HMAC-SHA256' : 'SHA256-UNKEYED-DEV',
    integrityHash: key ? createHmac('sha256', key).update(data).digest('hex') : createHash('sha256').update(data).digest('hex') };
}
export function validateConsentHistory(events, key = consentAuditKey()) {
  let previousHash = null;
  for (let index = 0; index < events.length; index++) {
    const e = events[index];
    if (e.sequence !== index + 1 || e.previousHash !== previousHash) return false;
    if (e.integrityAlgorithm !== (key ? 'HMAC-SHA256' : 'SHA256-UNKEYED-DEV')) return false;
    const computed = makeConsentEvent(e, key).integrityHash;
    if (typeof e.integrityHash !== 'string' || !/^[a-f0-9]{64}$/.test(e.integrityHash) ||
      !timingSafeEqual(Buffer.from(e.integrityHash, 'hex'), Buffer.from(computed, 'hex'))) return false;
    previousHash = e.integrityHash;
  }
  return true;
}
export function requiresFreshConsent(current, version, digest) {
  return !current || current.status !== 'granted' || current.policyVersion !== version ||
    current.textSha256 !== digest;
}
