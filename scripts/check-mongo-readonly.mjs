/** Explicit opt-in, read-only MongoDB production audit. NEVER modifies data or indexes. */
import { MongoClient } from 'mongodb';
import { mongoTransportErrors } from './transport-policy.mjs';
import { mongoDeploymentErrors, checkMongoTopology, checkMongoRoles } from './mongo-security-policy.mjs';

const uri = process.env.MONGO_URL;
const database = process.env.MONGO_DB;
const errors = [...mongoTransportErrors(uri), ...mongoDeploymentErrors(uri, database)];
const report = { scope: 'mongodb_read_only', connected: false, status: 'NOT_VERIFIED', errors: [...new Set(errors)], warnings: [] };
if (process.env.HODHOD_MONGO_AUDIT_CONFIRM !== 'read-only') {
  report.errors.push('EXPLICIT_READ_ONLY_CONFIRMATION_REQUIRED');
} else if (!errors.length) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, retryWrites: false, readPreference: 'primary' });
  try {
    await client.connect();
    report.connected = true;
    const admin = client.db('admin');
    const hello = await admin.command({ hello: 1 });
    report.errors.push(...checkMongoTopology(hello));
    const auth = await admin.command({ connectionStatus: 1, showPrivileges: false });
    const roles = auth?.authInfo?.authenticatedUserRoles;
    report.errors.push(...checkMongoRoles(roles, database));
    // List index metadata only, never query student/application documents.
    const db = client.db(database);
    const expected = [
      ['sessions', 'expiresAt_1'],
      ['passwordResetTokens', 'expiresAt_1'],
      ['emailVerificationTokens', 'expiresAt_1'],
      ['otpChallenges', 'expiresAt_1'],
      ['otpThrottle', 'expiresAt_1'],
      ['otpVerifyThrottle', 'expiresAt_1'],
      ['courseJoinCodes', 'expiresAt_1'],
    ];
    for (const [coll, indexName] of expected) {
      try {
        const index = (await db.collection(coll).listIndexes().toArray()).find(i => i.name === indexName);
        if (!index || index.expireAfterSeconds !== 0) report.errors.push(`MONGO_TTL_INDEX_MISSING_${coll}`);
      } catch (error) {
        if (error?.code === 26) report.errors.push(`MONGO_COLLECTION_MISSING_${coll}`);
        else report.errors.push(`MONGO_INDEX_INSPECTION_FAILED_${coll}`);
      }
    }
    if (hello.msg === 'isdbgrid') report.warnings.push('SHARDED_TOPOLOGY_TRANSACTION_SUPPORT_REQUIRES_OPERATIONAL_CONFIRMATION');
    // Network ACL, disk encryption, cert chain, backups, user privileges inherited from roles
    // are not externally provable from a client. Require infra validation separately.
    report.warnings.push('VERIFY_NETWORK_ACL_CERTIFICATE_ROTATION_ENCRYPTION_BACKUPS_OUT_OF_BAND');
    report.warnings.push('VERIFY_REPLICA_SET_MAJORITY_AND_TRANSACTION_SMOKE_IN_STAGING');
  } catch {
    report.errors.push('MONGO_READ_ONLY_PROBE_FAILED_CHECK_AUTH_TLS_REACHABILITY');
  } finally { await client.close().catch(() => {}); }
}
report.errors = [...new Set(report.errors)];
report.status = report.connected && report.errors.length === 0 ? 'PASS_WITH_EXTERNAL_CHECKS' : 'NOT_VERIFIED';
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS_WITH_EXTERNAL_CHECKS') process.exitCode = 1;
