import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studentConsentRequired, consentPolicyVersion, isValidGuardianConsent, CONSENT_SCOPE, consentProcessingSuspended } from '../../src/server/security/privacy-policy.ts';
test('Production fails closed for student data processing even if env says false', () => {
  assert.equal(studentConsentRequired({ NODE_ENV: 'production', STUDENT_CONSENT_REQUIRED: 'false' }), true);
  assert.equal(studentConsentRequired({ NODE_ENV: 'test' }), false);
  assert.equal(studentConsentRequired({ NODE_ENV: 'test', STUDENT_CONSENT_REQUIRED: 'true' }), true);
});
test('policy version defaults to owner-approved 1.0.0 and overrides stay bounded', () => {
  assert.equal(consentPolicyVersion({}), '1.0.0');
  assert.throws(() => consentPolicyVersion({ STUDENT_CONSENT_POLICY_VERSION: '' }));
  assert.equal(consentPolicyVersion({ STUDENT_CONSENT_POLICY_VERSION: 'ir-2026.1' }), 'ir-2026.1');
  assert.throws(() => consentPolicyVersion({ STUDENT_CONSENT_POLICY_VERSION: '<script>' }));
});
test('teacher invitation is not legal guardian verification', () => {
  const consent = { studentId: 's', guardianId: 'p', status: 'granted', policyVersion: 'v1', scope: CONSENT_SCOPE };
  assert.equal(isValidGuardianConsent({ verification: 'teacher_invited' }, consent, 'p', 's', 'v1'), false);
  assert.equal(isValidGuardianConsent({ status: 'verified', verifiedAt: 'now' }, consent, 'p', 's', 'v1'), true);
  assert.equal(isValidGuardianConsent({ status: 'verified', verifiedAt: 'now' }, { ...consent, status: 'revoked' }, 'p', 's', 'v1'), false);
  assert.equal(isValidGuardianConsent({ status: 'verified', verifiedAt: 'now' }, consent, 'p', 'other', 'v1'), false);
  assert.equal(isValidGuardianConsent({ status: 'verified', verifiedAt: 'now' }, consent, 'p', 's', 'v2'), false);
});

test('withdrawal suspends processing even if another guardian has an old valid grant', () => {
  assert.equal(consentProcessingSuspended({ consentProcessingSuspended: true }), true);
  assert.equal(consentProcessingSuspended({ consentProcessingSuspended: false }), false);
  assert.equal(consentProcessingSuspended({}), false); // legacy accounts remain governed by consent records
  assert.equal(consentProcessingSuspended(null), true);
});
