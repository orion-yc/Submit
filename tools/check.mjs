import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const assets = [manifest.background.service_worker, ...(manifest.action.default_icon ? Object.values(manifest.action.default_icon) : []), ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(entry => entry.js)];
for (const asset of assets) await readFile(path.join(root, asset));
if (manifest.name !== 'Submit' || manifest.version !== '2.0.0') throw new Error('扩展品牌信息与当前版本不一致。');
if (manifest.background.type !== 'module') throw new Error('后台工作线程必须启用原生模块。');
if (manifest.host_permissions.some(value => value.includes(`:${'87'.repeat(2)}`))) throw new Error('发现旧服务端口。');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) files.push(absolute);
  }
  return files;
}

for (const file of await walk(root)) {
  const relative = path.relative(root, file);
  if (relative === path.join('tools', 'check.mjs')) continue;
  if (relative.startsWith('backend\\')) continue;
  const source = await readFile(file, 'utf8');
  if (source.includes(`${'87'.repeat(2)}`)) throw new Error(`${relative} still references the retired port.`);
  if (file.endsWith('.js') || file.endsWith('.mjs')) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
console.log(`Submit ${manifest.version}: extension assets and modules are valid.`);
