import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRepository } from '../../scripts/scan-secrets.mjs';

test('secret scanner catches known-format secrets in code, logs and build output without exposing values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hodhod-secret-scan-'));
  const fake = 'gh' + 'p_' + 'A'.repeat(36); // test-only synthetic token
  try {
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'app.ts'), 'export const key = "' + fake + '";');
    await writeFile(join(root, 'dist', 'client.js'), 'const key = "' + fake + '";');
    await writeFile(join(root, 'app.log'), 'error: ' + fake);
    const result = await scanRepository(root);
    assert.equal(result.findings.filter(x => x.rule === 'GITHUB_TOKEN').length, 3);
    assert.equal(JSON.stringify(result).includes(fake), false);
  } finally { await rm(root, {recursive:true, force:true}); }
});

test('secret scanner detects database credentials but not local unauthenticated mongodb URLs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hodhod-secret-scan-'));
  try {
    await writeFile(join(root, '.env'), 'MONGO_URL=mongodb://' + 'dev:fictional-password@db.invalid/app\n');
    await writeFile(join(root, 'safe.txt'), 'MONGO_URL=mongodb://127.0.0.1:27017/test\n');
    const result = await scanRepository(root);
    assert.ok(result.findings.some(x => x.rule === 'MONGO_CREDENTIAL_URL'));
    assert.ok(!result.findings.some(x => x.file === 'safe.txt'));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('secret scanner detects PEM private keys in included evidence files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hodhod-secret-scan-'));
  try {
    await writeFile(join(root, 'evidence.log'), '-----BEGIN ' + 'PRIVATE KEY-----\nnot-a-real-key\n');
    const result = await scanRepository(root);
    assert.ok(result.findings.some(x=>x.rule === 'PRIVATE_KEY'));
  } finally { await rm(root,{recursive:true,force:true}); }
});
