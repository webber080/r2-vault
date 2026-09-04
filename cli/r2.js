#!/usr/bin/env node
// r2.js — R2 Vault CLI
// 用法：
//   node r2.js put <local-file> [<key>]      上传文件
//   node r2.js get <key> [<local-file>]     下载文件
//   node r2.js ls [<prefix>]                列文件
//   node r2.js rm <key>                     删除文件
//   node r2.js usage                        查看用量
//   node r2.js browse                       打开浏览器界面
//
// 鉴权：读 ~/.workbuddy/secrets/... 或 ~/.dsh/memory/... 或环境变量

import os from 'node:os';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const SECRETS_PATH = process.env.R2_TOKEN_FILE || resolve(os.homedir(), '.r2-vault', 'token');
const API_BASE = process.env.R2_BASE || '';  // 例如 https://r2.yourdomain.com
const UI_URL = process.env.R2_UI || '';      // 例如 https://files.yourdomain.com

function loadToken() {
  if (process.env.R2_TOKEN) return process.env.R2_TOKEN;
  if (existsSync(SECRETS_PATH)) {
    return readFileSync(SECRETS_PATH, 'utf8').trim();
  }
  console.error('❌ 未找到 token。请把 token 存到：');
  console.error('   ' + SECRETS_PATH);
  console.error('   或设置环境变量 R2_TOKEN');
  process.exit(1);
}

const TOKEN = loadToken();

async function api(path, opts = {}) {
  const r = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`API ${r.status}: ${t}`);
  }
  if (opts.raw) return r;
  return r.json();
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 ** 3) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 ** 3).toFixed(2) + ' GB';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

async function cmdPut(args) {
  if (args.length === 0) throw new Error('用法: put <local-file> [<key>]');
  const [localPath, customKey] = args;
  const absPath = resolve(localPath);
  if (!existsSync(absPath)) throw new Error('文件不存在: ' + absPath);
  const contentType = guessCT(absPath);
  const key = customKey || ('uploads/' + absPath.split('/').pop());
  const buf = readFileSync(absPath);
  console.log(`⬆  上传 ${absPath} (${fmtSize(buf.length)}) → ${key}`);
  const r = await api('/api/upload?key=' + encodeURIComponent(key), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buf,
  });
  console.log('✅ ' + JSON.stringify(r));
}

async function cmdGet(args) {
  if (args.length === 0) throw new Error('用法: get <key> [<local-file>]');
  const [key, localPath] = args;
  const outPath = localPath ? resolve(localPath) : resolve(key.split('/').pop());
  console.log(`⬇  下载 ${key} → ${outPath}`);
  const r = await api('/api/raw?key=' + encodeURIComponent(key), { raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log(`✅ ${fmtSize(buf.length)} bytes`);
}

async function cmdLs(args) {
  const prefix = args[0] || '';
  console.log(`📋  列出 prefix="${prefix}"`);
  const r = await api('/api/list?prefix=' + encodeURIComponent(prefix));
  console.log(`共 ${r.count} 个文件，${fmtSize(r.totalSize)}`);
  console.log('');
  if (r.objects.length === 0) {
    console.log('  (空)');
    return;
  }
  const wKey = Math.max(...r.objects.map(o => o.key.length), 20);
  for (const o of r.objects) {
    console.log(`  ${o.key.padEnd(wKey)}  ${fmtSize(o.size).padStart(10)}  ${fmtDate(o.uploaded)}`);
  }
}

async function cmdRm(args) {
  if (args.length === 0) throw new Error('用法: rm <key>');
  const [key] = args;
  await api('/api/delete?key=' + encodeURIComponent(key), { method: 'DELETE' });
  console.log(`🗑  已删除 ${key}`);
}

async function cmdUsage() {
  const r = await api('/api/usage');
  console.log('📊  R2 用量：');
  console.log(`   存储：${r.storage.used_gb} / ${r.storage.limit_gb} GB (${r.storage.pct}%)`);
  console.log(`   对象数：${r.objects.count}`);
  console.log(`   免费档限制：${r.limits.storage_gb}GB / ${r.limits.class_a} ClassA / ${r.limits.class_b} ClassB`);
}

function cmdBrowse() {
  console.log(`🌐 打开浏览器界面 ${UI_URL}`);
  spawn('open', [UI_URL], { stdio: 'inherit' });
}

function guessCT(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'application/javascript';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.md') || lower.endsWith('.txt') || lower.endsWith('.log')) return 'text/plain';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.tar') || lower.endsWith('.gz')) return 'application/gzip';
  if (lower.endsWith('.parquet')) return 'application/octet-stream';
  return 'application/octet-stream';
}

// 主入口
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    switch (cmd) {
      case 'put':
      case 'upload':
      case 'up':
        await cmdPut(args); break;
      case 'get':
      case 'download':
      case 'dl':
        await cmdGet(args); break;
      case 'ls':
      case 'list':
        await cmdLs(args); break;
      case 'rm':
      case 'delete':
      case 'del':
        await cmdRm(args); break;
      case 'usage':
      case 'stat':
        await cmdUsage(); break;
      case 'browse':
      case 'ui':
        cmdBrowse(); break;
      case undefined:
      case 'help':
      case '-h':
      case '--help':
        console.log(`R2 Vault CLI

用法：
  node r2.js put <local-file> [<key>]    上传
  node r2.js get <key> [<local-file>]   下载
  node r2.js ls [<prefix>]              列表
  node r2.js rm <key>                   删除
  node r2.js usage                      用量
  node r2.js browse                     打开浏览器界面

环境变量：
  R2_TOKEN   Agent Token（默认从 ~/.workbuddy/secrets/ 读）
  R2_BASE    API 域名（如 https://r2.yourdomain.com）
  R2_UI      浏览器界面（如 https://files.yourdomain.com）
`);
        break;
      default:
        console.error('未知命令: ' + cmd);
        process.exit(1);
    }
  } catch (e) {
    console.error('❌ ' + e.message);
    process.exit(1);
  }
}

main();
