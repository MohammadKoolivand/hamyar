/** Offline secret scanner. Only locations and rule names are printed, never values. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ignoredDirs = new Set(['node_modules', '.git', 'coverage', 'test-results', 'playwright-report']);
const binaryExt = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.ttf','.woff','.woff2','.zip','.gz','.mp4','.sqlite','.bin','.lockb']);
const sensitive = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|session[_-]?secret|otp[_-]?secret|smtp[_-]?password|mongo(?:db)?[_-]?(?:url|uri|password)|database[_-]?(?:url|uri|password)|melipayamak[_-]?password|mail[_-]?outbox[_-]?key|private[_-]?key|deploy[_-]?key|secret[_-]?key)/i;
const patterns = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ['GITHUB_TOKEN', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{25,}\b/g],
  ['GITHUB_FINE_GRAINED', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g],
  ['OPENAI_KEY', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g],
  ['AWS_ACCESS_KEY', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['GOOGLE_API_KEY', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['SLACK_TOKEN', /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g],
  ['MONGO_CREDENTIAL_URL', /mongodb(?:\+srv)?:\/\/[^\s"'<>/:]+:[^\s"'<>@/]+@[^\s"'<>]+/gi],
];
const isExample = (value) => !value || /^(?:\$\{|\$[A-Z_]|process\.env|import\.meta\.env|<[^>]+>|\{\{|example|dummy|fake|placeholder|changeme|replace_me|your[_-]|test[_-]|xxx+|\*+|\.\.\.|null|undefined|false|true|localhost|127\.0\.0\.1)/i.test(value) || /^0+$/.test(value);
function inspectLine(line, file, lineNo, out) {
  for (const [rule, regex] of patterns) {
    regex.lastIndex = 0;
    if (regex.test(line)) out.push({file, line:lineNo, rule, severity:'high'});
  }
  // Literal value in environment files, JSON, YAML, or JS assignments. Never print the value.
  const assignment = line.match(/^\s*["']?([A-Z][A-Z0-9_]*|[A-Za-z][A-Za-z0-9_-]*(?:secret|password|token|key|uri|url))["']?\s*[:=]\s*(.+?)\s*[,;]?\s*$/i);
  if (assignment && sensitive.test(assignment[1])) {
    const val = assignment[2].replace(/\s+(?:#|\/\/).*$/, '').trim().replace(/[,;]$/, '').replace(/^["'`]|["'`]$/g, '');
    // URLs to local databases have no credentials and are safe development defaults.
    if (!isExample(val) && !(/^mongodb(?:\+srv)?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[/?]|$)/.test(val)))
      out.push({file, line:lineNo, rule:'SENSITIVE_LITERAL_REVIEW', severity:'review'});
  }
}
export async function scanRepository(root) {
  root = resolve(root);
  const findings=[];
  let scannedFiles=0;
  async function walk(dir) {
    for (const ent of await readdir(dir, {withFileTypes:true})) {
      const path = resolve(dir, ent.name);
      if (ent.isDirectory()) {if (!ignoredDirs.has(ent.name)) await walk(path); continue;}
      if (!ent.isFile() || binaryExt.has(extname(ent.name).toLowerCase())) continue;
      const s = await stat(path);
      if (s.size > 4_000_000) continue;
      const buffer = await readFile(path);
      if (buffer.includes(0)) continue;
      scannedFiles++;
      const lines=buffer.toString('utf8').split(/\r?\n/);
      for(let i=0;i<lines.length;i++) inspectLine(lines[i],relative(root,path),i+1,findings);
    }
  }
  await walk(root);
  return {scannedFiles, findings:findings.filter((f,i,a)=>a.findIndex(x=>x.file===f.file&&x.line===f.line&&x.rule===f.rule)===i)};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root=resolve(process.argv[2] ?? '.');
  const result=await scanRepository(root);
  console.log(JSON.stringify(result,null,2));
  if(result.findings.some(f=>f.severity==='high') || (process.argv.includes('--strict') && result.findings.length)) process.exitCode=1;
}
