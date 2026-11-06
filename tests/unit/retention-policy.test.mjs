import {test} from 'node:test';
import assert from 'node:assert/strict';
import {policyMetadata,retentionCategories,validateRetentionInventory,canExecuteRetention,retentionPlan} from '../../scripts/retention-policy.mjs';
test('policy always starts unapproved and blocks execution',()=>{
 assert.equal(policyMetadata.status,'DRAFT_NOT_APPROVED');
 assert.ok(canExecuteRetention(policyMetadata,{}).includes('POLICY_NOT_APPROVED'));
});
test('even approved policy requires jurisdiction, references and explicit confirmation',()=>{
 const approved={...policyMetadata,status:'APPROVED',jurisdiction:'EU',legalReviewReference:'LEGAL-1',privacyOwnerApproval:'OWNER-1',effectiveAt:'2026-11-06'};
 assert.ok(canExecuteRetention(approved,{}).includes('EXECUTION_CONFIRMATION_MISSING'));
 assert.ok(canExecuteRetention(approved,{HODHOD_RETENTION_EXECUTE:'I_APPROVE_RETENTION_DELETIONS',HODHOD_RETENTION_APPROVAL_REFERENCE:'WRONG'}).includes('APPROVAL_REFERENCE_MISMATCH'));
 assert.deepEqual(canExecuteRetention(approved,{HODHOD_RETENTION_EXECUTE:'I_APPROVE_RETENTION_DELETIONS',HODHOD_RETENTION_APPROVAL_REFERENCE:'OWNER-1'}),[]);
});
test('every category is report-only and no cleanup is enabled',()=>{
 assert.ok(retentionCategories.every(c=>c.automated===false));
 assert.ok(retentionPlan().every(c=>c.mode==='REPORT_ONLY'));
});
test('duplicate or unknown collections cause inventory findings',()=>{
 const check=validateRetentionInventory(['users','inventedCollection'],[{id:'a',collections:['users']},{id:'b',collections:['users']}]);
 assert.deepEqual(check.uncovered,['inventedCollection']); assert.deepEqual(check.duplicates,['users']);
});
