// Source policy check: fails when forbidden terms or secret-like strings enter tracked sources.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Terms are assembled so this file does not match itself.
const FORBIDDEN = [
  new RegExp('micro' + 'metric' + 'ai', 'i'),
  new RegExp('fire' + 'base', 'i'),
  new RegExp('google-' + 'services', 'i'),
];
const SECRET_PATTERNS = [
  new RegExp('AI' + 'za[0-9A-Za-z_-]{35}'),
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
];
// Planning docs legitimately describe what must NOT be migrated from the legacy project.
const ALLOW_TERMS = new Set(['docs/MVP_PLAN.md', '.gitignore']);
const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ico',
  '.jar',
  '.woff2',
  '.keystore',
]);

function listFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  return out.split('\0').filter(Boolean);
}

const problems = [];
for (const rel of listFiles()) {
  const abs = join(root, rel);
  if (!existsSync(abs) || BINARY_EXT.has(extname(rel).toLowerCase())) continue;
  if (rel === 'package-lock.json') continue;
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  if (!ALLOW_TERMS.has(rel)) {
    for (const re of FORBIDDEN) if (re.test(text)) problems.push(`${rel}: forbidden term ${re}`);
  }
  for (const re of SECRET_PATTERNS) if (re.test(text)) problems.push(`${rel}: secret-like string`);
}

if (problems.length) {
  console.error('check-source failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('check-source: OK');
