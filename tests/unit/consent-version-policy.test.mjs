import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeConsentEvent, validateConsentHistory, requiresFreshConsent, consentTextFingerprint, consentAuditKey } from '../../scripts/consent-version-policy.mjs';
const key = 'this-is-an-isolated-test-key-with-adequate-length';
const base = { consentId:'a:b:educational-processing:v1', guardianId:'a', studentId:'b', consentType:'educational-processing:v1', textVersion:'v1', textSha256:'a'.repeat(64), method:'authenticated_parent_portal', status:'granted', recordedAt:'2026-01-01T00:00:00.000Z', relationshipId:'link1', actorId:'a', reason:'guardian_grant' };
test('earlier versions can be verified and retrieved unchanged', () => {
 const first=makeConsentEvent({...base,sequence:1,previousHash:null},key);
 const second=makeConsentEvent({...base,sequence:2,previousHash:first.integrityHash,textVersion:'v2',status:'revoked',reason:'guardian_revoke'},key);
 assert.ok(validateConsentHistory([first,second],key));
 assert.equal(first.textVersion,'v1');
 assert.equal(second.textVersion,'v2');
});
test('reordered or altered audit history fails integrity verification', () => {
 const e=makeConsentEvent({...base,sequence:1,previousHash:null},key);
 assert.equal(validateConsentHistory([{...e,status:'revoked'}],key),false);
 assert.equal(validateConsentHistory([e,{...e,sequence:2}],key),false);
});
test('any changed version or text fingerprint requires renewed consent', () => {
 const old={status:'granted',policyVersion:'v1',textSha256:'a'.repeat(64)};
 assert.equal(requiresFreshConsent(old,'v1','a'.repeat(64)),false);
 assert.equal(requiresFreshConsent(old,'v2','a'.repeat(64)),true);
 assert.equal(requiresFreshConsent(old,'v1','b'.repeat(64)),true);
 assert.equal(requiresFreshConsent({...old,status:'revoked'},'v1','a'.repeat(64)),true);
});
test('production refuses missing audit key or consent text fingerprint',()=>{
 assert.throws(()=>consentAuditKey({NODE_ENV:'production'}));
 assert.throws(()=>consentTextFingerprint({NODE_ENV:'production'}));
 assert.equal(consentTextFingerprint({NODE_ENV:'production', STUDENT_CONSENT_TEXT_SHA256:'f'.repeat(64)}),'f'.repeat(64));
});
