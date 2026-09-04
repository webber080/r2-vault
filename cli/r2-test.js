#!/usr/bin/env node
// r2-test.js — R2 Vault 端到端测试
// 覆盖：鉴权边界、上传、列表、下载、删除、usage、路径穿越防护、双域名行为
// 运行：node r2-test.js
// 退出码：0 = 全部通过，1 = 有失败

import os from 'node:os';
import { readFileSync } from 'node:fs';

const SECRETS = process.env.R2_TOKEN_FILE || os.homedir() + '/.r2-vault/token';
const API = process.env.R2_API || '';            // Agent 域（Bearer Token）
const UI = process.env.R2_UI_DOMAIN || '';       // 浏览器域（Cloudflare Access）
const FALLBACK = process.env.R2_FALLBACK || '';  // workers.dev 后备域（可选）

const TOKEN = process.env.R2_TOKEN || readFileSync(SECRETS, 'utf8').trim();

let passed = 0, failed = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function req(base, path, { method = 'GET', headers = {}, body } = {}) {
  const r = await fetch(base + path, { method, headers, body });
  return { status: r.status, text: await r.text(), headers: r.headers };
}

function auth(extra = {}) { return { Authorization: 'Bearer ' + TOKEN, ...extra }; }

// 生成唯一测试 key（跑完自动清理，不污染 bucket）
const RUN = Date.now().toString(36);
const K_TXT = `temp/test-${RUN}.txt`;
const K_BIN = `temp/test-${RUN}.bin`;
const K_META = `temp/test-${RUN}-meta.json`;

const TEXT_BODY = `R2 Vault test @ ${new Date().toISOString()}\n`.repeat(10);
// 二进制体：1024 字节伪随机
const BIN_BODY = Buffer.from(Array.from({ length: 1024 }, (_, i) => (i * 31 + 7) % 256));

// ═══════════════ 1. 鉴权边界 ═══════════════
console.log('\n■ 1. 鉴权边界');

{
  const r = await req(API, '/api/list');
  ok('无 token → 401', r.status === 401, `got ${r.status}`);
}
{
  const r = await req(API, '/api/list', { headers: { Authorization: 'Bearer wrong-token-xxx' } });
  ok('错误 token → 401', r.status === 401, `got ${r.status}`);
}
{
  const r = await req(API, '/api/list', { headers: auth() });
  ok('正确 token → 200', r.status === 200, `got ${r.status}`);
  try { JSON.parse(r.text); ok('list 返回合法 JSON', true); } catch { ok('list 返回合法 JSON', false); }
}
{
  const r = await req(UI, '/api/list', { headers: auth() });
  ok('Bearer token 在 files 域也有效（双域同一 worker）', r.status === 200, `got ${r.status}`);
}

// ═══════════════ 2. 上传 ═══════════════
console.log('\n■ 2. 上传');

{
  const r = await req(API, `/api/upload?key=${encodeURIComponent(K_TXT)}`, {
    method: 'PUT', headers: auth({ 'Content-Type': 'text/plain' }), body: TEXT_BODY,
  });
  const j = JSON.parse(r.text);
  ok('上传文本 200 + ok:true', r.status === 200 && j.ok === true, `got ${r.status}`);
  ok('回显 key 正确', j.key === K_TXT, j.key);
  ok('回显 contentType 正确', j.contentType === 'text/plain', j.contentType);
}
{
  const r = await req(API, `/api/upload?key=${encodeURIComponent(K_BIN)}`, {
    method: 'PUT', headers: auth({ 'Content-Type': 'application/octet-stream' }), body: BIN_BODY,
  });
  ok('上传二进制 1024B 200', r.status === 200, `got ${r.status}`);
}
{
  const meta = { 'x-meta-source': 'e2e-test', 'x-meta-run': RUN };
  const r = await req(API, `/api/upload?key=${encodeURIComponent(K_META)}`, {
    method: 'PUT', headers: auth({ 'Content-Type': 'application/json', ...meta }), body: '{"n":1}',
  });
  const j = JSON.parse(r.text);
  ok('x-meta-* 转为 customMetadata', j.meta?.source === 'e2e-test' && j.meta?.run === RUN, JSON.stringify(j.meta));
}
{
  // 无 key 参数 → 400/错误
  const r = await req(API, '/api/upload', { method: 'PUT', headers: auth(), body: 'x' });
  ok('缺 ?key → 4xx', r.status >= 400 && r.status < 500, `got ${r.status}`);
}
{
  // 路径穿越防护
  const r = await req(API, `/api/upload?key=${encodeURIComponent('../evil.txt')}`, {
    method: 'PUT', headers: auth(), body: 'evil',
  });
  ok('路径穿越 ../ 被拒', r.status >= 400, `got ${r.status}`);
}

// ═══════════════ 3. 列表 ═══════════════
console.log('\n■ 3. 列表');

{
  const r = await req(API, `/api/list?prefix=${encodeURIComponent('temp/')}`, { headers: auth() });
  const j = JSON.parse(r.text);
  const keys = j.objects.map(o => o.key);
  ok('prefix 过滤生效（3 个测试对象都在）',
    [K_TXT, K_BIN, K_META].every(k => keys.includes(k)),
    `got: ${keys.join(', ')}`);
  const txtObj = j.objects.find(o => o.key === K_TXT);
  ok('size 字段正确', txtObj?.size === Buffer.byteLength(TEXT_BODY), `want ${Buffer.byteLength(TEXT_BODY)} got ${txtObj?.size}`);
  ok('uploaded 是 ISO 时间', txtObj && !isNaN(Date.parse(txtObj.uploaded)), txtObj?.uploaded);
}
{
  const r = await req(API, `/api/list?limit=2`, { headers: auth() });
  const j = JSON.parse(r.text);
  ok('limit 分页参数被接受', j.count <= 2 || j.truncated !== undefined, `count=${j.count}`);
}
{
  const r = await req(API, `/api/list?prefix=${encodeURIComponent('nonexistent-xyz/')}`, { headers: auth() });
  const j = JSON.parse(r.text);
  ok('不存在的 prefix → 空列表不报错', r.status === 200 && j.count === 0);
}

// ═══════════════ 4. 下载 ═══════════════
console.log('\n■ 4. 下载');

{
  const r = await req(API, `/api/raw?key=${encodeURIComponent(K_TXT)}`, { headers: auth() });
  ok('文本下载字节一致', r.text === TEXT_BODY, `len ${r.text.length} vs ${TEXT_BODY.length}`);
  ok('Content-Type 保留', (r.headers.get('content-type') || '').includes('text/plain'), r.headers.get('content-type'));
}
{
  const r = await req(API, `/api/raw?key=${encodeURIComponent(K_BIN)}`, { headers: auth() });
  const buf = Buffer.from(await (await fetch(API + `/api/raw?key=${encodeURIComponent(K_BIN)}`, { headers: auth() })).arrayBuffer());
  ok('二进制下载字节一致', buf.equals(BIN_BODY), `len ${buf.length} vs ${BIN_BODY.length}`);
}
{
  const r = await req(API, `/api/raw?key=${encodeURIComponent('temp/no-such-file-' + RUN)}`, { headers: auth() });
  ok('下载不存在 → 404', r.status === 404, `got ${r.status}`);
}
{
  // download=1 应带 attachment 头（浏览器下载用）
  const r = await req(API, `/api/raw?key=${encodeURIComponent(K_TXT)}&download=1`, { headers: auth() });
  const cd = r.headers.get('content-disposition') || '';
  ok('download=1 → attachment 头', cd.includes('attachment'), cd || 'no header');
}

// ═══════════════ 5. usage ═══════════════
console.log('\n■ 5. usage');

{
  const r = await req(API, '/api/usage', { headers: auth() });
  const j = JSON.parse(r.text);
  ok('usage 200', r.status === 200);
  ok('limit_gb = 10', j.storage?.limit_gb === 10, JSON.stringify(j.storage));
  ok('pct 在 0-100', j.storage?.pct >= 0 && j.storage?.pct <= 100, j.storage?.pct);
  ok('objects.count ≥ 3（至少有本轮测试对象）', j.objects?.count >= 3, j.objects?.count);
}

// ═══════════════ 6. 删除 + 清理 ═══════════════
console.log('\n■ 6. 删除');

{
  for (const k of [K_TXT, K_BIN, K_META]) {
    const r = await req(API, `/api/delete?key=${encodeURIComponent(k)}`, { method: 'DELETE', headers: auth() });
    ok(`删除 ${k}`, r.status === 200, `got ${r.status}`);
  }
  const r = await req(API, `/api/list?prefix=${encodeURIComponent('temp/test-')}`, { headers: auth() });
  const j = JSON.parse(r.text);
  const left = j.objects.filter(o => o.key.includes(RUN));
  ok('删除后本轮对象清零', left.length === 0, `left: ${left.map(o => o.key).join(',')}`);
}
{
  const r = await req(API, `/api/delete?key=${encodeURIComponent('temp/never-existed')}`, { method: 'DELETE', headers: auth() });
  ok('删除不存在不报错（幂等）', r.status === 200 || r.status === 404, `got ${r.status}`);
}

// ═══════════════ 7. 浏览器域 Access 拦截 ═══════════════
console.log('\n■ 7. files 域 Cloudflare Access 拦截');
const SKIP_UI = !UI;

if (SKIP_UI) { console.log('  ⏭ 未配置 R2_UI_DOMAIN，跳过'); }
{
  const r = await fetch(UI + '/', { redirect: 'manual' });
  const loc = r.headers.get('location') || '';
  ok('匿名访问 → 302 跳 Access 登录', r.status === 302 && loc.includes('cloudflareaccess.com'), `${r.status} ${loc.slice(0, 60)}`);
}
{
  const r = await fetch(API + '/', { redirect: 'manual' });
  ok('r2 API 域不被 Access 拦截（Agent 可用）', r.status === 200 || r.status === 302 === false, `got ${r.status}`);
}

// ═══════════════ 结果 ═══════════════
console.log(`\n════════════════════════════`);
console.log(`通过 ${passed} / ${passed + failed}`);
if (failed) {
  console.log('失败项：');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('🎉 全部通过');
}
