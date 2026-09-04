import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(root, 'src');
const forbidden = [
  [/\bfetch\s*\(/u, 'fetch'],
  [/\bXMLHttpRequest\b/u, 'XMLHttpRequest'],
  [/\bsendBeacon\b/u, 'sendBeacon'],
  [/\bWebSocket\b/u, 'WebSocket'],
  [/\bEventSource\b/u, 'EventSource'],
  [/\blocalStorage\b/u, 'localStorage'],
  [/\bsessionStorage\b/u, 'sessionStorage'],
  [/\bdangerouslySetInnerHTML\b/u, 'dangerouslySetInnerHTML'],
  [/\bdocument\.cookie\b/u, 'Cookie'],
  [/https?:\/\//u, '外部URL'],
];

const files = walk(sourceRoot).filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'));
const failures = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) failures.push(`${relative(root, file)}: ${label}`);
  }
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
if (!html.includes("connect-src 'none'")) failures.push('index.html: connect-src none がありません');
if (/<(?:script|img|link)[^>]+(?:src|href)=["']https?:/iu.test(html)) failures.push('index.html: 外部アセットがあります');

if (failures.length) {
  process.stderr.write(`プライバシー検査に失敗しました。\n${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`プライバシー検査成功: ${files.length}ファイル、外部通信API・外部URLなし\n`);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
