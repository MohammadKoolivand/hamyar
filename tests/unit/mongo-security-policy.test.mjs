import test from 'node:test';
import assert from 'node:assert/strict';
import { mongoDeploymentErrors, checkMongoRoles, checkMongoTopology } from '../../scripts/mongo-security-policy.mjs';
import { deploymentChecks } from '../../scripts/check-deployment.mjs';
const valid = 'mongodb://app:fake-password@mongo.internal:27017/hamyar?authSource=hamyar&replicaSet=hodhod-rs&tls=true';
test('requires authenticated TLS replica set configuration', () => {
  assert.deepEqual(mongoDeploymentErrors(valid, 'hamyar'), []);
  assert.ok(mongoDeploymentErrors('mongodb://mongo.internal/hamyar?tls=true&replicaSet=rs', 'hamyar').includes('MONGO_APPLICATION_CREDENTIALS_REQUIRED'));
  assert.ok(mongoDeploymentErrors('mongodb://u:p@mongo.internal/hamyar?tls=true', 'hamyar').includes('MONGO_REPLICA_SET_OPTION_REQUIRED'));
  assert.ok(mongoDeploymentErrors(valid + '&directConnection=true', 'hamyar').includes('MONGO_DIRECT_CONNECTION_FORBIDDEN'));
  assert.ok(mongoDeploymentErrors(valid + '&tls=false', 'hamyar').includes('MONGO_DUPLICATE_URI_OPTION'));
});
test('disallows broad MongoDB roles and checks restricted application role', () => {
  assert.deepEqual(checkMongoRoles([{role:'readWrite', db:'hamyar'}], 'hamyar'), []);
  assert.ok(checkMongoRoles([{role:'root',db:'admin'}], 'hamyar').includes('MONGO_EXCESSIVE_ROLE_REVIEW_REQUIRED'));
  assert.ok(checkMongoRoles([{role:'read',db:'hamyar'}], 'hamyar').includes('MONGO_APPLICATION_READWRITE_ROLE_MISSING'));
});
test('requires supported transaction topology and sessions', () => {
  assert.deepEqual(checkMongoTopology({setName:'rs',logicalSessionTimeoutMinutes:30,maxWireVersion:21}), []);
  assert.ok(checkMongoTopology({isWritablePrimary:true,maxWireVersion:21}).includes('MONGO_TRANSACTION_TOPOLOGY_UNSUPPORTED'));
});
test('production preflight refuses unsafe Mongo connection without exposing secrets',()=>{
  const env={MONGO_URL:'mongodb://app:TOP_SECRET@mongo.internal/hamyar?tls=true',MONGO_DB:'hamyar',HODHOD_EXPECTED_DB:'hamyar',APP_ORIGIN:'https://app.example.test',COOKIE_SECURE:'true'};
  const check=deploymentChecks(env,'exams');
  assert.ok(check.errors.includes('MONGO_REPLICA_SET_OPTION_REQUIRED'));
  assert.ok(!JSON.stringify(check).includes('TOP_SECRET'));
});
