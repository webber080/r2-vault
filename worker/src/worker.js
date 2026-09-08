// r2-vault worker — AI Agent × Cloudflare R2 × 人工审阅界面
//
// 路由：
//   PUT    /api/upload?key=<key>   上传（Bearer Token 或已验证的 Access JWT）
//   GET    /api/list?prefix=&cursor=&limit=   列表（分页）
//   GET    /api/raw?key=<key>[&download=1][&inline=1]   原始字节
//   DELETE /api/delete?key=<key>   删除
//   GET    /api/usage              存储用量估算
//   GET    /                       单页 HTML 网页界面
//
// 鉴权模型（二选一）：
//   1. Bearer AGENT_TOKEN —— 给 AI Agent / CLI 用，所有域名有效
//   2. Cloudflare Access —— 仅当请求携带 cf-access-jwt-assertion 头且该 JWT
//      能通过 ACCESS_TEAM_DOMAIN 团队公钥（JWKS）的 RS256 签名验证。
//      注意：绝不信任"头部存在"本身——头部可以被任意客户端伪造，
//      只有密码学验证通过才算数。浏览器域（如 files.*）由 Cloudflare Access
//      在边缘拦截并注入真实 JWT；API 域与 workers.dev 天然没有 Access，
//      伪造的 JWT 会在签名验证处被拒绝。
//
// 环境变量（wrangler.toml [vars] 或 secret）：
//   AGENT_TOKEN         （secret，必填）Agent 的 Bearer Token
//   ACCESS_TEAM_DOMAIN  （可选）如 "yourteam.cloudflareaccess.com"，启用 Access JWT 验证
//   ACCESS_AUD          （可选）Access 应用的 AUD Tag，设置后额外校验 aud（多应用团队建议）
//   MAX_UPLOAD_MB       （可选）单文件上传上限，默认 512

import { BROWSER_HTML } from './browser-html.js';

// PWA manifest：安卓 Chrome「安装到主屏幕」后成为独立 App（全屏、有图标）
const MANIFEST_JSON = JSON.stringify({
  name: 'R2 Vault',
  short_name: 'R2 Vault',
  description: 'Cloudflare R2 personal vault',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f4f6fb',
  theme_color: '#4f6df5',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
});

// Service Worker：App Shell 离线缓存。
// HTML no-store（保证更新及时），静态图标缓存；API 请求永不缓存。
const SW_JS = `
const SHELL_CACHE = 'r2vault-shell-v1';
const SHELL_ASSETS = ['/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // API 永不拦截
  if (SHELL_ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  }
});
`;

// TWA Digital Asset Links（用于 Android TWA 验证：包名 + 签名 cert SHA-256）
// APK 用 debug key 签名，真机正式发版时换成生产 keystore 的 SHA-256
const ASSET_LINKS_JSON = JSON.stringify([{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: 'top.supertato.r2vault',
    sha256_cert_fingerprints: ['6c656474c8d59b8c8916d4e4889ad23ef7bd9bd94dbb3e1845852158a1b9cc70'],
  },
}]);

// 应用图标（渐变圆角方块 + 白色箱体，程序化 PNG 生成太重，用 SVG 转 PNG 不行——
// 直接内嵌两枚 base64 PNG。这里用最小合法 PNG：渐变背景 + 简单图形由前端 canvas 生成不可行，
// 改为纯色圆角图标（视觉干净即可）。
// 生成方式：单色 #4f6df5 背景 + 白色居中方块，像素数据程序化构造。
function makeIconPng(size) {
  const px = [];
  const r = size * 0.22; // 圆角
  for (let y = 0; y < size; y++) {
    px.push(0); // filter: none
    for (let x = 0; x < size; x++) {
      // 圆角判断
      const cx = Math.min(x, size - 1 - x), cy = Math.min(y, size - 1 - y);
      const inside = cx + cy >= r || (cx >= r || cy >= r) || true;
      // 简化：整个方形填充即可（maskable 图标需要满版背景）
      // 渐变：从左上 #6a8bff 到右下 #4f6df5
      const t = (x + y) / (2 * size);
      const R = Math.round(0x6a + (0x4f - 0x6a) * t);
      const G = Math.round(0x8b + (0x6d - 0x8b) * t);
      const B = Math.round(0xff + (0xf5 - 0xff) * t);
      // 中央白色"箱体"图形：一个圆角方形轮廓（模拟存储箱）
      const boxS = size * 0.34, boxX0 = (size - boxS) / 2, boxY0 = (size - boxS * 0.78) / 2 + size * 0.03, boxY1 = boxY0 + boxS * 0.78;
      const inBox = x >= boxX0 && x <= boxX0 + boxS && y >= boxY0 && y <= boxY1;
      // 箱盖：顶部 1/3 高度，白色实心
      const lidY1 = boxY0 + boxS * 0.26;
      const lidLine = boxY0 <= y && y <= boxY0 + size * 0.035;
      // 箱体边框：左右与底部 3px 线
      const border = size * 0.032;
      const onFrame = inBox && (
        y <= boxY0 + border ||                                    // 顶
        x <= boxX0 + border || x >= boxX0 + boxS - border ||       // 左右
        y >= boxY1 - border                                        // 底
      );
      // 锁孔：中央小方块
      const keyX0 = size/2 - size*0.075, keyX1 = size/2 + size*0.075;
      const keyY0 = boxY0 + boxS*0.42, keyY1 = keyY0 + size*0.15;
      const onKey = x >= keyX0 && x <= keyX1 && y >= keyY0 && y <= keyY1;
      if (onFrame || onKey) px.push(255, 255, 255, 255);
      else px.push(R, G, B, 255);
    }
  }
  const raw = new Uint8Array(px);
  // PNG 编码（IHDR + IDAT zlib stored blocks + IEND），CRC 手算
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size); dv.setUint32(4, size);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  // zlib: stored (uncompressed) deflate blocks
  const maxBlock = 65535;
  const nBlocks = Math.ceil(raw.length / maxBlock);
  const z = new Uint8Array(2 + raw.length + nBlocks * 5 + 4);
  let zi = 0;
  z[zi++] = 0x78; z[zi++] = 0x01;
  for (let i = 0; i < nBlocks; i++) {
    const seg = raw.subarray(i * maxBlock, (i + 1) * maxBlock);
    const last = i === nBlocks - 1 ? 1 : 0;
    z[zi++] = last;
    z[zi++] = seg.length & 0xff; z[zi++] = seg.length >> 8;
    z[zi++] = ~seg.length & 0xff; z[zi++] = (~seg.length >> 8) & 0xff;
    z.set(seg, zi); zi += seg.length;
  }
  const adler = (() => {
    let a = 1, b = 0;
    for (const byte of raw) { a = (a + byte) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
  })();
  new DataView(z.buffer).setUint32(zi, adler);
  return new Uint8Array([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...chunk('IHDR', ihdr), ...chunk('IDAT', z), ...chunk('IEND', new Uint8Array(0)),
  ]);
}

const TEMP_PREFIX = 'temp/';
const TEMP_MAX_AGE_DAYS = 14;
const LIST_PAGE_SIZE = 1000;
const MAX_KEY_LEN = 900;          // R2 上限 1024，留余量
const MAX_META_HEADERS = 8;
const MAX_META_VALUE_BYTES = 256;

// 免费档阈值（展示用）
const FREE_LIMITS = { storage_gb: 10, class_a: 1_000_000, class_b: 10_000_000 };

// 允许 inline 预览的安全类型白名单
// 注意：text/html 和 image/svg+xml 一律不 inline —— 两者都可携带脚本，
// 在本站域名下渲染等于存储型 XSS。
const INLINE_SAFE_CT = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/x-icon',
  'application/pdf', 'text/plain', 'text/csv',
  'video/', 'audio/',
];

// htmlview 专用 raw CSP：把存储型 HTML 关进不透明沙箱源
// （无 allow-same-origin → 读不到本站 cookie/localStorage；无 allow-top-navigation
//   → 不能劫持查看页；form/action/postMessage 全关）
const HTMLVIEW_RAW_CSP =
  "sandbox; default-src 'none'; img-src data: blob: https: http:; " +
  "style-src 'unsafe-inline' https: http:; font-src data: https: http:; " +
  "media-src data: blob: https: http:; script-src 'unsafe-inline' 'unsafe-eval'; " +
  "form-action 'none'; frame-ancestors 'self'";

// ──────────────── 通用工具 ────────────────

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function err(message, status = 400) {
  return json({ error: message }, { status });
}

// 安全响应头（HTML 用 CSP，API/raw 用 nosniff）
function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  };
}

const HTML_SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
    "img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'self'; " +
    "font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ──────────────── 手机 HTML 全屏查看器（/htmlview）────────────────
// 背景：text/html 在本站源下直接渲染 = 存储型 XSS，所以 /api/raw 对 HTML
// 一律 attachment（下载）。但手机上「先下载→文件管理→打开」太繁琐，且预览
// modal 在手机上只有 390px 宽，看文档没有意义。
// 方案：顶层全屏查看页 + sandbox iframe + CSP sandbox 双保险。
//   - iframe 无 allow-same-origin → 内容脚本运行在不透明源，拿不到本站
//     cookie / localStorage / token；
//   - /api/raw 响应再叠加 CSP: sandbox → 即使有人直接在顶层标签打开同一条
//     raw URL，文档也强制进沙箱源，防线不依赖「必须从 iframe 加载」；
//   - 查看页占满整屏（100dvh + safe-area），支持双指缩放与 +/- 按钮缩放，
//     顶栏提供 关闭/刷新，下载走 attachment（沙箱内 a[download] 被禁，由
//     顶栏代劳）。
const HTMLVIEW_PAGE = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=0.4,maximum-scale=6,user-scalable=yes,viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<title>查看</title>
<style>
  * { box-sizing: border-box; -webkit-text-size-adjust: 100%; }
  html, body { margin: 0; padding: 0; height: 100%; background: #0f172a; overscroll-behavior: none; }
  #bar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; gap: 2px;
         padding: calc(env(safe-area-inset-top) + 6px) 8px 6px; background: rgba(15,23,42,.94); color: #e2e8f0;
         font: 500 14px/1 system-ui, sans-serif; }
  #bar button { flex: 0 0 auto; min-width: 42px; min-height: 40px; border: 0; border-radius: 9px;
         background: transparent; color: #e2e8f0; font-size: 19px; padding: 0 8px; cursor: pointer; }
  #bar button:active { background: rgba(255,255,255,.14); }
  #name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; opacity: .85; }
  #zoomTag { flex: 0 0 auto; font-size: 12px; color: #93a4c3; min-width: 42px; text-align: center; }
  #stage { position: fixed; inset: 0; padding-top: calc(env(safe-area-inset-top) + 52px); background: #0f172a; }
  #frameWrap { width: 100%; height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
  iframe { display: block; border: 0; background: #fff; transform-origin: 0 0; }
</style>
</head>
<body>
<div id="bar">
  <button id="back" title="关闭">✕</button>
  <span id="name"></span>
  <button id="zo" title="缩小">−</button>
  <span id="zoomTag">100%</span>
  <button id="zi" title="放大">＋</button>
  <button id="rf" title="刷新">⟳</button>
</div>
<div id="stage"><div id="frameWrap"><iframe id="f" sandbox="allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="preview"></iframe></div></div>
<script>
(function () {
  var P = new URLSearchParams(location.search);
  var KEY = P.get('key') || '';
  var TOKEN = P.get('token') || '';
  var BASE = location.origin + '/api/raw?key=' + encodeURIComponent(KEY) + '&inline=1&htmlview=1';
  if (TOKEN) BASE += '&token=' + encodeURIComponent(TOKEN);
  document.getElementById('name').textContent = KEY.split('/').pop();
  var f = document.getElementById('f');
  var wrap = document.getElementById('frameWrap');
  var z = 1, MIN = 0.5, MAX = 4;
  function apply() {
    var r = wrap.getBoundingClientRect();
    var w = Math.max(200, Math.round(r.width / z));
    var h = Math.max(200, Math.round(r.height / z));
    f.style.width = w + 'px';
    f.style.height = h + 'px';
    f.style.transform = z === 1 ? 'none' : 'scale(' + z + ')';
    document.getElementById('zoomTag').textContent = Math.round(z * 100) + '%';
  }
  function step(d) { z = Math.min(MAX, Math.max(MIN, Math.round((z + d) * 100) / 100)); apply(); }
  document.getElementById('zi').onclick = function () { step(+0.25); };
  document.getElementById('zo').onclick = function () { step(-0.25); };
  document.getElementById('rf').onclick = function () { f.src = BASE; };
  document.getElementById('back').onclick = function () {
    if (history.length > 1) history.back(); else location.href = '/';
  };
  f.addEventListener('dblclick', function () { z = z === 1 ? 2 : 1; apply(); });
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', function () { setTimeout(apply, 250); });
  f.src = BASE;
  apply();
})();
</script>
</body>
</html>`;

// ──────────────── key 校验 ────────────────

function validKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.length > MAX_KEY_LEN) return false;
  if (key.startsWith('/')) return false;
  if (key.endsWith('/')) return false;
  if (key.includes('\\')) return false;
  if (key.includes('\0')) return false;
  // 拒绝控制字符
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(key)) return false;
  // 拒绝 .. 路径段（R2 key 虽是扁平的，但保持直觉上的"路径"语义）
  for (const seg of key.split('/')) {
    if (seg === '..' || seg === '.') return false;
  }
  return true;
}

// ──────────────── 鉴权 ────────────────

// 常量时间比较：先 SHA-256 抹平长度/内容时序，再逐字节异或
function sha256Bytes(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
}
async function timingSafeEqualStr(a, b) {
  const [da, db] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function checkAgentAuth(request, env, url) {
  // Bearer 头优先；?token= 兜底（仅用于 <img>/<embed> 等无法自定义头部的标签，
  // 且仅限 GET 类接口使用——写操作必须走头）。
  // 匹配任意已配置的 token（AGENT_TOKEN + 可选 MOBILE_TOKEN），
  // 各自可单独吊销——手机丢了只 revoke MOBILE_TOKEN 即可，不影响其他 Agent。
  let candidate = null;
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) candidate = m[1];
  else if (url && ['GET', 'HEAD'].includes(request.method)) {
    const q = url.searchParams.get('token');
    if (q) candidate = q;
  }
  if (!candidate) return false;
  if (env.AGENT_TOKEN && (await timingSafeEqualStr(candidate, env.AGENT_TOKEN))) return true;
  if (env.MOBILE_TOKEN && (await timingSafeEqualStr(candidate, env.MOBILE_TOKEN))) return true;
  return false;
}

// ── Cloudflare Access JWT 验证 ──
// JWKS 模块级缓存（团队公钥，1 小时刷新）
let jwksCache = { keys: null, fetchedAt: 0 };

async function getJwks(teamDomain) {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < 3600_000) return jwksCache.keys;
  const r = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('jwks fetch failed');
  const j = await r.json();
  jwksCache = { keys: j.keys || [], fetchedAt: now };
  return jwksCache.keys;
}

function b64urlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function verifyAccessJwt(token, env) {
  if (!env.ACCESS_TEAM_DOMAIN) return false; // 未配置 Access → 不接受 JWT
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  let claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return false;
  }
  const expectedIss = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (claims.iss !== expectedIss) return false;
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < now - 60) return false;   // 过期（60s 余量）
  if (claims.nbf && claims.nbf > now + 60) return false;
  if (env.ACCESS_AUD) {
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(env.ACCESS_AUD)) return false;
  }

  // 签名验证（RS256）：kid 在 JOSE header（parts[0]），不在 payload
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    return false;
  }
  if (header.alg && header.alg !== 'RS256') return false;   // 算法混淆防护
  let keys;
  try {
    keys = await getJwks(env.ACCESS_TEAM_DOMAIN);
  } catch {
    return false;
  }
  const kid = header.kid;
  const jwk = keys.find((k) => k.kid === kid) || (keys.length === 1 ? keys[0] : null);
  if (!jwk) {
    // 可能是密钥轮换 → 强制刷新一次
    jwksCache = { keys: null, fetchedAt: 0 };
    try {
      keys = await getJwks(env.ACCESS_TEAM_DOMAIN);
    } catch {
      return false;
    }
    const retry = keys.find((k) => k.kid === kid);
    if (!retry) return false;
    return verifySig(retry, parts);
  }
  return verifySig(jwk, parts);
}

async function verifySig(jwk, parts) {
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = b64urlToBytes(parts[2]);
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  } catch {
    return false;
  }
}

async function checkAccessAuth(request, env) {
  const jwt = request.headers.get('cf-access-jwt-assertion');
  if (!jwt) return false;
  return verifyAccessJwt(jwt, env);
}

// ──────────────── Content-Disposition ────────────────

function asciiFallbackName(name) {
  // 去掉引号/反斜杠/控制字符，非 ASCII 折叠为 _
  return name.replace(/["\\/\u0000-\u001f]/g, '_').replace(/[^\x20-\x7e]/g, '_') || 'file';
}

function contentDisposition(kind, filename) {
  return `${kind}; filename="${asciiFallbackName(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function isInlineSafe(ct) {
  if (!ct) return false;
  const c = ct.toLowerCase();
  if (c === 'text/markdown') return true;
  return INLINE_SAFE_CT.some((p) => c === p || c.startsWith(p));
}

// ──────────────── 目录归类 ────────────────

function bucketTop(key) {
  if (!key) return '_root';
  const seg = key.split('/')[0];
  const known = ['reports', 'datasets', 'downloads', 'temp'];
  return known.includes(seg) ? seg : '_other';
}

// ──────────────── 主入口 ────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const host = (request.headers.get('Host') || '').toLowerCase();
    const isBrowserHost = host.startsWith('files.');

    // 预检：不带 CORS 头（界面同源、Agent 非浏览器，无需跨域开放）
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    // HTML 界面：根路径直接返回（无论哪个 host）
    if (path === '/' || path === '/index.html') {
      return new Response(BROWSER_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...HTML_SECURITY_HEADERS },
      });
    }

    // 手机 HTML 全屏查看页：/htmlview?key=<key>[&token=]
    // 鉴权与 /api/* 完全一致（Bearer token 或已验证 Access JWT）——生产环境
    // 手机 PWA 走 Access cookie（无 token），必须接受 JWT 才能进。
    // 页面本身不含文件内容，真正取数由沙箱 iframe 走 /api/raw?inline=1&htmlview=1
    if (path === '/htmlview' && request.method === 'GET') {
      const key = url.searchParams.get('key');
      if (!key) return err('Missing ?key=<path>');
      if (!validKey(key)) return err('Invalid key', 400);
      const agentOk = await checkAgentAuth(request, env, url);
      const accessOk = agentOk ? false : await checkAccessAuth(request, env);
      if (!agentOk && !accessOk) return err('Unauthorized', 401);
      return new Response(HTMLVIEW_PAGE, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...securityHeaders({ 'Referrer-Policy': 'no-referrer' }),
        },
      });
    }

    // ──────────────── PWA 资产 ────────────────
    if (path === '/manifest.webmanifest') {
      return new Response(MANIFEST_JSON, {
        headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
      });
    }
    if (path === '/sw.js') {
      return new Response(SW_JS, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
      });
    }
    const iconMatch = path.match(/^\/icon-(192|512)\.png$/);
    if (iconMatch) {
      // CSP 下 <link rel=icon> 也 OK；PNG 是构建时程序化生成，缓存 1 天
      return new Response(makeIconPng(parseInt(iconMatch[1], 10)), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
      });
    }
    // TWA Digital Asset Links：让 Android TWA 验证包名 + 签名，
    // 验证通过后系统隐藏 URL 栏，体验等同原生 App
    if (path === '/.well-known/assetlinks.json') {
      return new Response(ASSET_LINKS_JSON, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    // /api/whoami —— 诊断端点：放在鉴权前，报告请求里各凭证的存在性与 JWT 校验结果（不泄露密钥值）
    if (path === '/api/whoami' && request.method === 'GET') {
      const jwt = request.headers.get('cf-access-jwt-assertion');
      let identity = null;
      if (jwt) {
        try {
          const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(jwt.split('.')[1])));
          identity = { email: payload.email || null, iat: payload.iat || null };
        } catch { /* ignore */ }
      }
      // 实测：把当前请求当一次调用试 checkAgentAuth——不报 token 内容，只报 true/false
      // 用空 url 不影响 Bearer 头路径（?token= 路径需要 url，这里跳过）
      const testUrl = new URL(request.url); const testOk = await checkAgentAuth(request, env, testUrl);
      return json({
        hasJwtHeader: !!jwt,
        hasEmailHeader: !!request.headers.get('cf-access-authenticated-user-email'),
        hasAccessCookie: /CF_Authorization=/.test(request.headers.get('Cookie') || ''),
        hasBearer: !!(request.headers.get('Authorization') || '').match(/^Bearer\s/i),
        jwtSignatureValid: jwt ? await verifyAccessJwt(jwt, env) : false,
        agentAuthTestResult: testOk,    // Bearer 头测一次（含 ?token= 失败场景）—— null url 跳过 token 路径
        agentTokenConfigured: !!env.AGENT_TOKEN,
        mobileTokenConfigured: !!env.MOBILE_TOKEN,
        identity,
        teamDomainConfigured: !!env.ACCESS_TEAM_DOMAIN,
      });
    }

    // ──────────────── /api/* ────────────────
    if (path.startsWith('/api/')) {
      const agentOk = await checkAgentAuth(request, env, url);
      const accessOk = agentOk ? false : await checkAccessAuth(request, env);
if (!agentOk && !accessOk) return err('Unauthorized', 401);

      // PUT /api/upload?key=<key>
      if (path === '/api/upload' && request.method === 'PUT') {
        const key = url.searchParams.get('key');
        if (!key) return err('Missing ?key=<path>');
        if (!validKey(key)) return err('Invalid key', 400);

        // 上传大小限制
        const maxBytes = (parseInt(env.MAX_UPLOAD_MB || '512', 10) || 512) * 1024 * 1024;
        const cl = request.headers.get('content-length');
        if (cl && parseInt(cl, 10) > maxBytes) {
          return err(`File too large (max ${Math.round(maxBytes / 1048576)} MB)`, 413);
        }

        const ct =
          url.searchParams.get('contentType') ||
          request.headers.get('Content-Type') ||
          'application/octet-stream';

        // x-meta-* → customMetadata（数量与大小受限）
        const meta = {};
        for (const [h, v] of request.headers) {
          if (h.toLowerCase().startsWith('x-meta-')) {
            if (Object.keys(meta).length >= MAX_META_HEADERS) return err('Too many x-meta-* headers', 400);
            if (v.length > MAX_META_VALUE_BYTES) return err(`x-meta header too long: ${h.slice(0, 32)}`, 400);
            meta[h.slice(7).toLowerCase()] = v;
          }
        }

        try {
          await env.agent_vault.put(key, request.body, {
            httpMetadata: { contentType: ct },
            customMetadata: meta,
          });
        } catch (e) {
          return err('Upload failed: ' + String(e.message || e).slice(0, 120), 500);
        }
        return json({ ok: true, key, contentType: ct, meta });
      }

      // GET /api/list
      if (path === '/api/list' && request.method === 'GET') {
        const prefix = url.searchParams.get('prefix') || '';
        const cursor = url.searchParams.get('cursor') || undefined;
        const n = parseInt(url.searchParams.get('limit') || LIST_PAGE_SIZE, 10);
        const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 1000) : LIST_PAGE_SIZE;

        const listed = await env.agent_vault.list({ prefix, cursor, limit });
        const objects = listed.objects.map((o) => ({
          key: o.key,
          size: o.size,
          uploaded: o.uploaded.toISOString(),
          etag: o.etag,
          httpMetadata: o.httpMetadata || {},
          customMetadata: o.customMetadata || {},
        }));
        return json({
          prefix,
          count: objects.length,
          totalSize: objects.reduce((s, o) => s + o.size, 0),
          truncated: listed.truncated,
          cursor: listed.truncated ? listed.cursor : null,
          objects,
        });
      }

      // GET /api/raw?key=<key>[&download=1][&inline=1]
      if (path === '/api/raw' && request.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) return err('Missing ?key=<path>');
        if (!validKey(key)) return err('Invalid key', 400);
        const obj = await env.agent_vault.get(key);
        if (!obj) return err('Not Found', 404);

        let ct = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream';
        // markdown 预览时降级为纯文本，保证浏览器内联显示
        if (ct === 'text/markdown' && url.searchParams.get('inline') === '1') ct = 'text/plain';

        const fname = key.split('/').pop() || 'file';
        const wantDownload = url.searchParams.get('download') === '1';
        const wantInline = url.searchParams.get('inline') === '1';
        const wantHtmlView = url.searchParams.get('htmlview') === '1';
        // 浏览器域直接访问默认下载（防直连渲染不可信内容）；显式 inline=1 且类型安全才内联
        let kind = 'attachment';
        if (wantInline && isInlineSafe(ct)) kind = 'inline';
        else if (!wantDownload && !isBrowserHost) kind = 'inline'; // API 域给 Agent 原始字节，无所谓

        // htmlview 模式：text/html 经专用沙箱通道内联（查看页/预览 iframe 专用）。
        // 安全性靠三层：① 仅接受显式 htmlview=1（UI 只在沙箱 iframe 里用它）；
        // ② 响应带 CSP sandbox → 文档运行在不透明源，拿不到本站任何 cookie；
        // ③ nosniff + no-store。顶层直接打开这条 raw URL 也被 CSP sandbox 兜住。
        const headers = new Headers();
        if (wantInline && ct === 'text/html') {
          if (wantHtmlView) {
            headers.set('Content-Security-Policy', HTMLVIEW_RAW_CSP);
          } else {
            kind = 'attachment'; // 无 htmlview 标记的 HTML 仍按原防线强制下载
          }
        }
        headers.set('Content-Type', ct);
        headers.set('ETag', obj.etag);
        headers.set('Last-Modified', obj.uploaded.toUTCString());
        headers.set('Content-Disposition', contentDisposition(kind, fname));
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Cache-Control', wantInline ? 'private, max-age=300' : 'no-store');
        return new Response(obj.body, { headers });
      }

      // DELETE /api/delete?key=<key>
      if (path === '/api/delete' && request.method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key) return err('Missing ?key=<path>');
        if (!validKey(key)) return err('Invalid key', 400);
        await env.agent_vault.delete(key);
        return json({ ok: true, deleted: key });
      }

      // GET /api/usage
      if (path === '/api/usage' && request.method === 'GET') {
        let totalSize = 0;
        let count = 0;
        let cursor;
        for (let i = 0; i < 50; i++) {
          const r = await env.agent_vault.list({ prefix: '', cursor, limit: 1000 });
          for (const o of r.objects) {
            totalSize += o.size;
            count++;
          }
          if (!r.truncated) break;
          cursor = r.cursor;
        }
        const usedGb = totalSize / (1024 ** 3);
        return json({
          storage: {
            used_bytes: totalSize,
            used_gb: +usedGb.toFixed(4),
            limit_gb: FREE_LIMITS.storage_gb,
            pct: +((usedGb / FREE_LIMITS.storage_gb) * 100).toFixed(2),
          },
          objects: { count },
          limits: FREE_LIMITS,
        });
      }

      return err('Not Found', 404);
    }

    // 浏览器域其他路径 → 当作文件 key 下载（保持 attachment，安全默认）
    if (isBrowserHost && path !== '/') {
      let key;
      try {
        key = decodeURIComponent(path).replace(/^\//, '');
      } catch {
        return err('Bad Request', 400);
      }
      if (!key || !validKey(key)) return err('Bad Request', 400);
      const obj = await env.agent_vault.get(key);
      if (!obj) return err('Not Found', 404);
      const headers = new Headers();
      headers.set('Content-Type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream');
      headers.set('Content-Disposition', contentDisposition('attachment', key.split('/').pop() || 'file'));
      headers.set('Cache-Control', 'private, max-age=60');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(obj.body, { headers });
    }

    return err('Not Found', 404);
  },

  // Cron Trigger：清理 temp/ 下过期文件
  async scheduled(event, env, ctx) {
    const cutoff = Date.now() - TEMP_MAX_AGE_DAYS * 24 * 3600 * 1000;
    let cursor;
    let deletedCount = 0;
    let deletedBytes = 0;

    for (let i = 0; i < 100; i++) {
      const r = await env.agent_vault.list({ prefix: TEMP_PREFIX, cursor, limit: 1000 });
      const toDelete = [];
      for (const o of r.objects) {
        if (o.uploaded.getTime() < cutoff) {
          toDelete.push(o.key);
          deletedBytes += o.size;
        }
      }
      if (toDelete.length > 0) {
        await env.agent_vault.delete(toDelete);
        deletedCount += toDelete.length;
      }
      if (!r.truncated) break;
      cursor = r.cursor;
    }
  },
};
