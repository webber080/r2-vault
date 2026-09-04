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

async function checkAgentAuth(request, env) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || !env.AGENT_TOKEN) return false;
  return timingSafeEqualStr(m[1], env.AGENT_TOKEN);
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
      return json({
        hasJwtHeader: !!jwt,
        hasEmailHeader: !!request.headers.get('cf-access-authenticated-user-email'),
        hasAccessCookie: /CF_Authorization=/.test(request.headers.get('Cookie') || ''),
        hasBearer: !!(request.headers.get('Authorization') || '').match(/^Bearer\s/i),
        jwtSignatureValid: jwt ? await verifyAccessJwt(jwt, env) : false,
        identity,
        teamDomainConfigured: !!env.ACCESS_TEAM_DOMAIN,
      });
    }

    // ──────────────── /api/* ────────────────
    if (path.startsWith('/api/')) {
      const agentOk = await checkAgentAuth(request, env);
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
        // 浏览器域直接访问默认下载（防直连渲染不可信内容）；显式 inline=1 且类型安全才内联
        let kind = 'attachment';
        if (wantInline && isInlineSafe(ct)) kind = 'inline';
        else if (!wantDownload && !isBrowserHost) kind = 'inline'; // API 域给 Agent 原始字节，无所谓

        const headers = new Headers();
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

    console.log(
      `[r2-vault] cleanup done: deleted=${deletedCount} bytes=${deletedBytes} prefix=${TEMP_PREFIX} max_age_days=${TEMP_MAX_AGE_DAYS}`,
    );
  },
};
