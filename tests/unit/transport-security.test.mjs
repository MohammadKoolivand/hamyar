import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mongoTransportErrors, providerTransportErrors } from '../../scripts/transport-policy.mjs';
import { deploymentChecks } from '../../scripts/check-deployment.mjs';
const base = { MONGO_URL:'mongodb+srv://user:synthetic@cluster.example.test/app', MONGO_DB:'app', HODHOD_EXPECTED_DB:'app', APP_ORIGIN:'https://app.example.test', COOKIE_SECURE:'true' };
test('rejects MongoDB plaintext and certificate verification bypass',()=>{
  assert.ok(mongoTransportErrors('mongodb://mongo.example.test/db').includes('MONGO_TLS_REQUIRED'));
  assert.deepEqual(mongoTransportErrors('mongodb://mongo.example.test/db?tls=true'),[]);
  assert.deepEqual(mongoTransportErrors('mongodb+srv://cluster.example.test/db'),[]);
  assert.ok(mongoTransportErrors('mongodb+srv://cluster.example.test/db?tls=false').includes('MONGO_TLS_DISABLED'));
  for(const key of ['tlsInsecure','tlsAllowInvalidCertificates','tlsAllowInvalidHostnames']) {
    assert.ok(mongoTransportErrors(`mongodb://mongo.example.test/db?tls=true&${key}=true`).includes('MONGO_TLS_VERIFICATION_WEAKENED'));
  }
});
test('rejects remote plaintext AI endpoints but permits loopback-only HTTP',()=>{
  assert.ok(providerTransportErrors('http://ai.example.test:11434').includes('AI_TLS_REQUIRED'));
  assert.deepEqual(providerTransportErrors('http://127.0.0.1:11434'),[]);
  assert.deepEqual(providerTransportErrors('https://ai.example.test'),[]);
  assert.ok(providerTransportErrors('https://user:pass@ai.example.test').includes('AI_ENDPOINT_INVALID'));
});
test('production preflight checks both data and AI transport without exposing secrets',()=>{
  assert.deepEqual(deploymentChecks(base, 'exams').errors,[]);
  const result=deploymentChecks({...base, MONGO_URL:'mongodb://user:PRIVATE@mongo.example.test/db',AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://ai.example.test'},'web');
  assert.ok(result.errors.includes('MONGO_TLS_REQUIRED'));
  assert.ok(result.errors.includes('AI_TLS_REQUIRED'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
