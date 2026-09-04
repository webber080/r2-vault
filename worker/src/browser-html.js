// Cloud Drive 风格单页 HTML — v2
// 设计目标：美观 + 全尺寸响应式（手机 ≤720 / 平板 ≤1024 / 桌面）
// 左：目录树（移动端变抽屉）；右：文件卡片网格；顶：搜索 + 额度 + 操作
// 鉴权：CF Access cookie 优先，回退 localStorage token

export const BROWSER_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<title>R2 Vault</title>
<style>
  :root {
    --bg: #f4f6fb;
    --panel: #ffffff;
    --border: #e6e9f0;
    --text: #17203a;
    --muted: #69718a;
    --brand: #4f6df5;
    --brand-deep: #3b55e0;
    --brand-soft: #eceffe;
    --danger: #e5484d;
    --danger-soft: #fdebec;
    --ok: #2fa96e;
    --warn: #f5a524;
    --shadow-1: 0 1px 2px rgba(23,32,58,.05), 0 6px 20px rgba(23,32,58,.06);
    --shadow-2: 0 12px 40px rgba(23,32,58,.16);
    --r-s: 8px; --r-m: 12px; --r-l: 18px;
    --mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --topbar-h: 58px;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; }
  body {
    margin: 0;
    font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: var(--text);
    background:
      radial-gradient(1200px 500px at 85% -10%, rgba(79,109,245,.10), transparent 60%),
      radial-gradient(900px 400px at -10% 110%, rgba(47,169,110,.07), transparent 55%),
      var(--bg);
    overflow: hidden;
  }
  button, input, select { font: inherit; color: inherit; }
  button { cursor: pointer; border: 1px solid var(--border); background: var(--panel); border-radius: 10px; min-height: 40px; padding: 8px 14px; transition: .16s; }
  button:hover { border-color: #cdd4e4; background: #fafbfe; }
  button:active { transform: scale(.97); }
  button.primary { background: linear-gradient(135deg, var(--brand), var(--brand-deep)); color: #fff; border: none; box-shadow: 0 4px 14px rgba(79,109,245,.35); }
  button.primary:hover { filter: brightness(1.06); }
  button.danger { color: var(--danger); border-color: #f6c8ca; background: #fff; }
  button.danger:hover { background: var(--danger-soft); }
  button.icon-btn { width: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 17px; }

  /* ─────────── 顶栏 ─────────── */
  header.topbar {
    height: var(--topbar-h);
    display: flex; align-items: center; gap: 12px;
    padding: 0 16px;
    background: rgba(255,255,255,.85);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    position: relative; z-index: 30;
  }
  .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; letter-spacing: .2px; white-space: nowrap; }
  .logo .mark {
    width: 32px; height: 32px; border-radius: 9px; flex: none;
    background: linear-gradient(135deg, #6a8bff, #4f6df5 55%, #7c5cff);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 16px;
    box-shadow: 0 4px 12px rgba(79,109,245,.4);
  }
  .logo .badge {
    font-size: 11px; font-weight: 500; color: var(--muted);
    background: #eef1f7; border: 1px solid var(--border);
    padding: 2px 8px; border-radius: 99px; font-family: var(--mono);
  }
  .breadcrumb { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); overflow: hidden; white-space: nowrap; }
  .crumb { cursor: pointer; padding: 3px 6px; border-radius: 6px; }
  .crumb:hover { background: var(--brand-soft); color: var(--brand); }
  .breadcrumb .sep { opacity: .45; }
  .search {
    display: flex; align-items: center; gap: 8px;
    background: #eef1f7; border: 1px solid transparent; border-radius: 99px;
    padding: 0 14px; height: 40px; width: 260px; flex: none;
    transition: .16s;
  }
  .search:focus-within { background: #fff; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,109,245,.15); }
  .search input { border: none; outline: none; background: transparent; width: 100%; min-width: 0; }
  .search svg { color: var(--muted); flex: none; }
  .top-actions { display: flex; gap: 8px; flex: none; }

  /* 汉堡按钮（移动端） */
  button.icon-btn.menu-btn { display: none; }

  /* ─────────── 额度条 ─────────── */
  .quota {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 18px;
    padding: 10px 16px;
    background: rgba(255,255,255,.75);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }
  .quota .stat-label { color: var(--muted); display: flex; justify-content: space-between; gap: 8px; }
  .quota .stat-value { font-family: var(--mono); font-weight: 600; color: var(--text); }
  .quota .bar { height: 6px; background: #e8ebf3; border-radius: 99px; overflow: hidden; margin-top: 5px; }
  .quota .bar > div { height: 100%; background: linear-gradient(90deg, #6a8bff, var(--brand)); border-radius: 99px; transition: width .5s ease; }
  .quota .bar.warn > div { background: linear-gradient(90deg, #ffd280, var(--warn)); }
  .quota .bar.danger > div { background: linear-gradient(90deg, #ff8f92, var(--danger)); }

  /* ─────────── 主区 ─────────── */
  main { display: flex; height: calc(100dvh - var(--topbar-h) - 56px); }

  aside.tree {
    width: 232px; flex: none;
    background: rgba(255,255,255,.8);
    border-right: 1px solid var(--border);
    padding: 14px 10px; overflow-y: auto;
  }
  .tree-section-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; padding: 4px 12px 8px; font-weight: 700; }
  .tree-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; min-height: 44px;
    border-radius: 10px; cursor: pointer; user-select: none;
    color: var(--text); margin-bottom: 2px;
    border: 1px solid transparent;
    transition: .15s;
  }
  .tree-item:hover { background: #f2f5fc; }
  .tree-item.active { background: var(--brand-soft); border-color: #dfe5ff; color: var(--brand-deep); font-weight: 600; }
  .tree-item .icon { font-size: 17px; width: 22px; text-align: center; flex: none; }
  .tree-item .count { margin-left: auto; font-size: 11px; color: var(--muted); font-family: var(--mono); background: #eef1f7; padding: 1px 8px; border-radius: 99px; }
  .tree-item.active .count { background: #dde4ff; color: var(--brand-deep); }

  section.files { flex: 1; overflow-y: auto; padding: 18px 20px 40px; }
  .files-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .files-header h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .files-header .meta { color: var(--muted); font-size: 12px; font-family: var(--mono); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 14px; }
  .card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: var(--r-m); padding: 12px;
    cursor: pointer; position: relative; overflow: hidden;
    transition: .18s;
  }
  .card:hover { border-color: #c8d2ff; box-shadow: var(--shadow-1); transform: translateY(-2px); }
  .card .icon-wrap {
    height: 104px; border-radius: 9px; margin-bottom: 10px;
    background: linear-gradient(135deg, #f2f5fc, #e9edf7);
    display: flex; align-items: center; justify-content: center;
    font-size: 38px; color: var(--muted); overflow: hidden;
  }
  .card .icon-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .card .name { font-weight: 600; font-size: 13px; word-break: break-all; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
  .card .meta { font-size: 11px; color: var(--muted); font-family: var(--mono); display: flex; justify-content: space-between; margin-top: 5px; }
  .card .actions {
    position: absolute; top: 8px; right: 8px; display: flex; gap: 6px;
    opacity: 0; transform: translateY(-4px); transition: .18s;
  }
  .card:hover .actions, .card:focus-within .actions { opacity: 1; transform: none; }
  .card .actions button { min-height: 30px; padding: 4px 10px; font-size: 12px; box-shadow: var(--shadow-1); }
  /* 触屏：操作按钮常显 */
  @media (hover: none) { .card .actions { opacity: 1; transform: none; } }

  .empty { text-align: center; color: var(--muted); padding: 80px 20px; font-size: 13px; }
  .empty .big { font-size: 46px; margin-bottom: 14px; opacity: .45; }

  /* ─────────── 模态 ─────────── */
  .modal-bg {
    position: fixed; inset: 0; background: rgba(15,23,42,.45);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; padding: 16px;
  }
  .modal {
    background: #fff; border-radius: var(--r-l); padding: 22px;
    width: min(440px, 100%); max-height: 92dvh; overflow-y: auto;
    box-shadow: var(--shadow-2);
    animation: pop .18s ease-out;
  }
  .modal.wide { width: min(920px, 100%); height: min(86dvh, 780px); display: flex; flex-direction: column; }
  .modal h3 { margin: 0 0 14px; font-size: 16px; }
  .modal .key-line { font-family: var(--mono); font-size: 12px; word-break: break-all; color: var(--muted); margin: -6px 0 12px; }
  .modal .row { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; flex-wrap: wrap; }
  .modal .row .spacer { margin-right: auto; }
  .field { display: grid; gap: 6px; margin-bottom: 12px; }
  .field label { font-size: 12px; color: var(--muted); font-weight: 600; }
  .field input, .field select {
    padding: 10px 12px; min-height: 44px; border: 1px solid var(--border); border-radius: 10px; outline: none; background: #fbfcfe; width: 100%;
  }
  .field input:focus, .field select:focus { border-color: var(--brand); background: #fff; box-shadow: 0 0 0 3px rgba(79,109,245,.14); }
  #preview-body { flex: 1; min-height: 0; border-radius: 12px; overflow: hidden; background: #f2f4f9; display: flex; }
  #preview-body img { max-width: 100%; max-height: 100%; margin: auto; object-fit: contain; }
  #preview-body iframe, #preview-body embed { width: 100%; height: 100%; border: none; background: #fff; }
  @keyframes pop { from { opacity: 0; transform: scale(.96) translateY(8px); } to { opacity: 1; transform: none; } }

  .loading {
    position: fixed; inset: 0; background: rgba(255,255,255,.6);
    backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center;
    z-index: 60; color: var(--muted); font-size: 13px; gap: 10px;
  }
  .spinner { width: 20px; height: 20px; border: 2.5px solid #dbe1f0; border-top-color: var(--brand); border-radius: 50%; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1c2540; color: #fff; padding: 11px 20px;
    border-radius: 12px; font-size: 13px; box-shadow: var(--shadow-2);
    z-index: 200; animation: toast-in .2s ease-out; max-width: 90vw;
  }
  .toast.err { background: var(--danger); }
  .toast.ok { background: var(--ok); }
  @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

  /* ─────────── 上传任务面板（右下角） ─────────── */
  .upload-panel {
    position: fixed; right: 16px; bottom: 16px; z-index: 90;
    width: min(360px, calc(100vw - 32px));
    background: #fff; border: 1px solid var(--border); border-radius: 14px;
    box-shadow: var(--shadow-2); overflow: hidden;
    display: none; flex-direction: column;
    max-height: min(440px, 62dvh);
    animation: pop .18s ease-out;
  }
  .upload-panel.show { display: flex; }
  .upload-panel-head {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    font-weight: 700; font-size: 13px; user-select: none; flex: none;
  }
  .upload-panel-head .u-summary { margin-left: auto; font-size: 11px; color: var(--muted); font-family: var(--mono); font-weight: 500; }
  .upload-panel-head button { min-height: 28px; padding: 2px 10px; font-size: 11px; }
  .upload-panel.collapsed .upload-list { display: none; }
  .upload-list { overflow-y: auto; padding: 8px 10px 10px; display: grid; gap: 8px; }
  .upload-item { border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; font-size: 12px; }
  .upload-item .u-name { font-weight: 600; word-break: break-all; display: flex; gap: 8px; align-items: baseline; }
  .upload-item .u-name span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .upload-item .u-name .u-state { margin-left: auto; flex: none; font-family: var(--mono); font-size: 11px; color: var(--muted); font-weight: 500; }
  .upload-item .u-sub { color: var(--muted); font-size: 11px; font-family: var(--mono); margin-top: 2px; display: flex; justify-content: space-between; gap: 8px; }
  .upload-item .u-bar { height: 5px; background: #e8ebf3; border-radius: 99px; overflow: hidden; margin-top: 7px; }
  .upload-item .u-bar > div { height: 100%; width: 0; background: linear-gradient(90deg, #6a8bff, var(--brand)); border-radius: 99px; transition: width .2s linear; }
  .upload-item.done .u-bar > div { background: var(--ok); }
  .upload-item.err .u-bar > div, .upload-item.canceled .u-bar > div { background: #c9cedd; }
  .upload-item.err .u-state { color: var(--danger); }
  .upload-item.done .u-state { color: var(--ok); }
  .upload-item .u-ops { display: flex; gap: 6px; margin-top: 7px; }
  .upload-item .u-ops button { min-height: 26px; padding: 2px 10px; font-size: 11px; }
  .upload-item.done { opacity: .72; }

  /* ─────────── 整页拖拽上传 ─────────── */
  .dropzone {
    position: fixed; inset: 0; z-index: 150;
    background: rgba(79,109,245,.12);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    border: 3px dashed var(--brand);
    display: none; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .dropzone.show { display: flex; }
  .dropzone .dz-inner {
    background: #fff; border-radius: 16px; padding: 26px 34px;
    font-size: 15px; font-weight: 600; box-shadow: var(--shadow-2);
  }
  .dropzone .dz-inner b { color: var(--brand); }

  /* 遮罩（移动抽屉） */
  .scrim { position: fixed; inset: 0; background: rgba(15,23,42,.4); z-index: 39; opacity: 0; pointer-events: none; transition: .2s; }
  .scrim.show { opacity: 1; pointer-events: auto; }

  /* ═══════════ 响应式 ═══════════ */
  /* 平板 ≤1024：搜索收窄 */
  @media (max-width: 1024px) {
    .search { width: 190px; }
    .logo .badge { display: none; }
    .grid { grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); }
  }
  /* 手机 ≤720：抽屉侧栏 + 精简顶栏 */
  @media (max-width: 720px) {
    button.icon-btn.menu-btn { display: inline-flex; }
    .breadcrumb { display: none; }
    .search { flex: 1; width: auto; }
    .top-actions button span.txt { display: none; }
    .top-actions button { padding: 8px 11px; }
    .quota { grid-template-columns: 1fr 1fr; gap: 8px 14px; padding: 8px 12px; }
    .quota .stat:nth-child(3) { display: none; }
    main { height: calc(100dvh - var(--topbar-h) - 52px); }
    aside.tree {
      position: fixed; top: var(--topbar-h); bottom: 0; left: 0; z-index: 40;
      width: 264px; transform: translateX(-105%);
      transition: transform .24s ease; box-shadow: none;
      padding-top: 18px;
    }
    aside.tree.open { transform: none; box-shadow: var(--shadow-2); }
    section.files { padding: 14px 12px 40px; }
    .grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .card .icon-wrap { height: 88px; font-size: 32px; }
  }
  /* 小手机 ≤400 */
  @media (max-width: 400px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    .logo span.title { display: none; }
  }
  @media (min-width: 721px) { .scrim { display: none; } }
</style>
</head>
<body>

<header class="topbar">
  <button class="icon-btn menu-btn" id="menuBtn" aria-label="菜单">☰</button>
  <div class="logo"><span class="mark">📦</span><span class="title">R2 Vault</span><span class="badge">agent-vault</span></div>
  <nav class="breadcrumb" id="breadcrumb"></nav>
  <div class="search">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.6" y2="16.6"></line></svg>
    <input id="search" placeholder="搜索文件名…" autocomplete="off">
  </div>
  <div class="top-actions">
    <button class="primary" onclick="openUpload()">⬆<span class="txt"> 上传</span></button>
    <button class="icon-btn" onclick="refreshAll()" aria-label="刷新">↻</button>
  </div>
</header>

<div class="quota" id="quota"></div>

<main>
  <div class="scrim" id="scrim" onclick="toggleTree(false)"></div>
  <aside class="tree" id="tree">
    <div class="tree-section-title">分类</div>
    <div class="tree-item active" data-prefix="" onclick="nav('')">
      <span class="icon">🏠</span><span>全部</span><span class="count" id="count-all">–</span>
    </div>
    <div class="tree-item" data-prefix="reports/" onclick="nav('reports/')">
      <span class="icon">📊</span><span>reports</span><span class="count" id="count-reports">–</span>
    </div>
    <div class="tree-item" data-prefix="datasets/" onclick="nav('datasets/')">
      <span class="icon">🗄️</span><span>datasets</span><span class="count" id="count-datasets">–</span>
    </div>
    <div class="tree-item" data-prefix="downloads/" onclick="nav('downloads/')">
      <span class="icon">⬇️</span><span>downloads</span><span class="count" id="count-downloads">–</span>
    </div>
    <div class="tree-item" data-prefix="temp/" onclick="nav('temp/')">
      <span class="icon">🗑️</span><span>temp · 14天清理</span><span class="count" id="count-temp">–</span>
    </div>
    <div class="tree-section-title" style="margin-top:14px">存储</div>
    <div style="padding:4px 12px;font-size:11px;color:var(--muted);line-height:1.7" id="store-note">
      Cloudflare R2 免费档<br>10GB 存储 · 流量免费
    </div>
  </aside>

  <section class="files">
    <div class="files-header">
      <h2 id="current-path">全部</h2>
      <span class="meta" id="current-meta"></span>
    </div>
    <div class="grid" id="grid"></div>
  </section>
</main>

<div id="modal-root"></div>
<div id="loading" class="loading" style="display:none"><span class="spinner"></span>加载中…</div>

<!-- 上传任务面板 -->
<div class="upload-panel" id="uploadPanel">
  <div class="upload-panel-head">
    <span id="upTitle">📤 上传任务</span>
    <span class="u-summary" id="upSummary"></span>
    <button onclick="togglePanel()" id="upToggleBtn" aria-label="收起">收起</button>
    <button onclick="clearFinished()">清完</button>
  </div>
  <div class="upload-list" id="upList"></div>
</div>

<!-- 整页拖拽层 -->
<div class="dropzone" id="dropzone"><div class="dz-inner">松开鼠标，<b>上传到「<span id="dzTarget">全部</span>」</b></div></div>

<script>
// ─── 配置 ───
// 同源调用：<UI域名>/api/*，CF Access cookie 自动携带
const API_BASE = location.origin;
let TOKEN = localStorage.getItem('r2_token') || '';

// CF Access 通过后设 CF_Authorization cookie；有它就跳过 token 输入页
const HAS_ACCESS = document.cookie.split(';').some(c => c.trim().startsWith('CF_Authorization='));

if (!TOKEN && !HAS_ACCESS) {
  document.body.innerHTML = \`
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:20px;background:#f4f6fb">
      <div style="background:#fff;padding:34px 30px;border-radius:18px;box-shadow:0 12px 40px rgba(23,32,58,.14);width:min(400px,100%)">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6a8bff,#4f6df5 55%,#7c5cff);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px">📦</div>
        <h2 style="margin:0 0 6px;font-size:19px">R2 Vault</h2>
        <p style="margin:0 0 20px;color:#69718a;font-size:13px">输入访问令牌以继续。令牌只保存在本浏览器。</p>
        <input id="token-input" type="password" placeholder="访问令牌" autocomplete="current-password"
          style="width:100%;padding:12px 14px;min-height:44px;border:1px solid #e6e9f0;border-radius:10px;font-family:ui-monospace,Menlo,monospace;font-size:13px;outline:none">
        <button onclick="saveToken()" style="margin-top:14px;width:100%;min-height:46px;background:linear-gradient(135deg,#4f6df5,#3b55e0);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer">进入</button>
        <p style="margin:14px 0 0;font-size:11px;color:#9aa1b5">令牌错误会提示 401，可重新输入。</p>
      </div>
    </div>\`;
  window.saveToken = () => {
    const v = document.getElementById('token-input').value.trim();
    if (!v) return;
    localStorage.setItem('r2_token', v);
    location.reload();
  };
  document.getElementById('token-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveToken();
  });
  throw new Error('awaiting token');
}

// ─── 状态 ───
let currentPrefix = '';
let searchQuery = '';

// ─── API ───
async function api(path, opts = {}) {
  const r = await fetch(API_BASE + path, opts);
  if (!r.ok) {
    const t = await r.text();
    throw new Error('API ' + r.status + ': ' + t.slice(0, 120));
  }
  return r.json();
}

// ─── 工具 ───
function fileIcon(key, ct) {
  ct = (ct || '').toLowerCase();
  const k = key.toLowerCase();
  // list() 返回的 httpMetadata 可能为空，用扩展名兜底
  const isImg = ct.startsWith('image/') || /\\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(k);
  if (isImg) return { type: 'img' };
  if (ct.includes('pdf') || k.endsWith('.pdf')) return '📕';
  if (ct.includes('zip') || ct.includes('tar') || ct.includes('gzip') || /\\.(zip|tar|gz|7z|rar)$/.test(k)) return '🗜️';
  if (ct.includes('json') || k.endsWith('.json')) return '🔣';
  if (ct.includes('csv') || ct.includes('excel') || /\\.(csv|xlsx?|tsv)$/.test(k)) return '📊';
  if (ct.includes('html') || /\\.?html?$/.test(k)) return '🌐';
  if (ct.includes('text') || ct.includes('markdown') || /\\.(txt|md|log)$/.test(k)) return '📝';
  if (k.endsWith('.parquet')) return '🧱';
  if (/\\.(mp4|mov|webm|avi|mkv)$/.test(k)) return '🎬';
  if (/\\.(mp3|wav|flac|m4a|aac|ogg)$/.test(k)) return '🎵';
  if (/\\.(js|mjs|ts|py|sh|rs|go|java|c|cpp|h)$/.test(k)) return '💻';
  if (/\\.(docx?|pages)$/.test(k)) return '📘';
  if (/\\.(pptx?|key)$/.test(k)) return '📙';
  if (/\\.(xlsx?|numbers)$/.test(k)) return '📗';
  return '📄';
}
function humanSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n/1048576).toFixed(1) + ' MB';
  return (n/1073741824).toFixed(2) + ' GB';
}
function humanDate(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return Math.max(1, Math.floor(diff)) + ' 秒前';
  if (diff < 3600) return Math.floor(diff/60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff/3600) + ' 小时前';
  if (diff < 86400*7) return Math.floor(diff/86400) + ' 天前';
  return d.toLocaleDateString('zh-CN');
}
function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ─── 列表 ───
async function loadList(prefix) {
  showLoading(true);
  try {
    const r = await api('/api/list?prefix=' + encodeURIComponent(prefix));
    let objs = r.objects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      objs = objs.filter(o => o.key.toLowerCase().includes(q));
    }
    // 按上传时间倒序（最新在前）
    objs.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    const grid = document.getElementById('grid');
    if (objs.length === 0) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">🪣</div>' + (searchQuery ? '没有匹配的文件' : '此目录为空') + '</div>';
    } else {
      grid.innerHTML = objs.map(o => {
        const ic = fileIcon(o.key, o.httpMetadata.contentType);
        const name = o.key.split('/').pop();
        const thumb = ic.type === 'img'
          ? '<img src="' + API_BASE + '/api/raw?key=' + encodeURIComponent(o.key) + '&inline=1" loading="lazy" alt="">'
          : ic;
        return '<div class="card" tabindex="0" data-key="' + esc(o.key) + '" onclick="onCardClick(this.dataset.key)" onkeydown="if(event.key===\\'Enter\\')onCardClick(this.dataset.key)">' +
          '<div class="icon-wrap">' + thumb + '</div>' +
          '<div class="name" title="' + esc(name) + '">' + esc(name) + '</div>' +
          '<div class="meta"><span>' + humanSize(o.size) + '</span><span>' + humanDate(o.uploaded) + '</span></div>' +
          '<div class="actions">' +
            '<button onclick="event.stopPropagation();downloadFile(\\'' + jsq(o.key) + '\\')">下载</button>' +
            '<button class="danger" onclick="event.stopPropagation();deleteFile(\\'' + jsq(o.key) + '\\')">删除</button>' +
          '</div></div>';
      }).join('');
    }
    document.getElementById('current-path').textContent = prefix ? (prefix.replace(/\\/$/, '')) : '全部';
    document.getElementById('current-meta').textContent =
      objs.length + ' 个文件 · 共 ' + humanSize(objs.reduce((s,o)=>s+o.size,0));
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    showLoading(false);
  }
}
function jsq(s) { return s.replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'"); }

// ─── 计数 ───
async function loadCounts() {
  const cats = { '': 'count-all', 'reports/': 'count-reports', 'datasets/': 'count-datasets', 'downloads/': 'count-downloads', 'temp/': 'count-temp' };
  for (const [p, id] of Object.entries(cats)) {
    try {
      const r = await api('/api/list?prefix=' + encodeURIComponent(p));
      document.getElementById(id).textContent = r.count;
    } catch { document.getElementById(id).textContent = '?'; }
  }
}

// ─── 额度 ───
async function loadUsage() {
  try {
    const u = await api('/api/usage');
    const s = u.storage;
    const cls = s.pct > 90 ? 'danger' : s.pct > 70 ? 'warn' : '';
    document.getElementById('quota').innerHTML =
      '<div class="stat"><div class="stat-label"><span>存储用量</span><span class="stat-value">' + s.used_gb.toFixed(3) + ' / ' + s.limit_gb + ' GB</span></div>' +
      '<div class="bar ' + cls + '"><div style="width:' + Math.min(s.pct, 100) + '%"></div></div></div>' +
      '<div class="stat"><div class="stat-label"><span>对象数</span><span class="stat-value">' + u.objects.count.toLocaleString() + '</span></div>' +
      '<div class="bar"><div style="width:' + Math.min(u.objects.count / 10000 * 100, 100) + '%"></div></div></div>' +
      '<div class="stat"><div class="stat-label"><span>免费额度</span><span class="stat-value">10GB · 流量免费</span></div>' +
      '<div class="bar"><div style="width:' + Math.min(s.pct, 100) + '%;opacity:.35"></div></div></div>';
  } catch {
    document.getElementById('quota').innerHTML = '<div style="color:var(--muted);grid-column:1/-1">额度统计加载失败</div>';
  }
}

// ─── 导航 ───
function nav(prefix) {
  currentPrefix = prefix;
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector('.tree-item[data-prefix="' + prefix + '"]');
  if (active) active.classList.add('active');
  renderBreadcrumb(prefix);
  loadList(prefix);
  toggleTree(false);
}
function renderBreadcrumb(prefix) {
  const parts = prefix.split('/').filter(Boolean);
  let html = '<span class="crumb" onclick="nav(\\'\\')">🏠</span>';
  let acc = '';
  for (const p of parts) {
    acc += p + '/';
    html += '<span class="sep">/</span><span class="crumb" onclick="nav(\\'' + jsq(acc) + '\\')">' + esc(p) + '</span>';
  }
  document.getElementById('breadcrumb').innerHTML = html;
}

// ─── 移动端抽屉 ───
function toggleTree(on) {
  document.getElementById('tree').classList.toggle('open', on);
  document.getElementById('scrim').classList.toggle('show', on);
}
document.getElementById('menuBtn').addEventListener('click', () => {
  toggleTree(!document.getElementById('tree').classList.contains('open'));
});

// ─── 文件操作 ───
function onCardClick(key) {
  const ct = guessContentType(key);
  if (ct.startsWith('image/') || ct === 'application/pdf' || ct.startsWith('text/')) openPreview(key, ct);
  else downloadFile(key);
}
function guessContentType(key) {
  const k = key.toLowerCase();
  if (k.endsWith('.html') || k.endsWith('.htm')) return 'text/html';
  if (k.endsWith('.md')) return 'text/markdown';
  if (k.endsWith('.txt') || k.endsWith('.log')) return 'text/plain';
  if (k.endsWith('.json')) return 'application/json';
  if (k.endsWith('.csv')) return 'text/csv';
  if (k.endsWith('.pdf')) return 'application/pdf';
  const imgMatch = k.match(/\\.(png|jpe?g|gif|webp|svg|bmp|ico)$/);
  if (imgMatch) return 'image/' + (imgMatch[1] === 'jpg' ? 'jpeg' : imgMatch[1]);
  return 'application/octet-stream';
}
function downloadFile(key) {
  const a = document.createElement('a');
  a.href = API_BASE + '/api/raw?key=' + encodeURIComponent(key) + '&download=1';
  a.download = key.split('/').pop();
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function deleteFile(key) {
  if (!confirm('确认删除？\\n' + key)) return;
  showLoading(true);
  try {
    await api('/api/delete?key=' + encodeURIComponent(key), { method: 'DELETE' });
    toast('已删除', 'ok');
    await Promise.all([loadList(currentPrefix), loadCounts(), loadUsage()]);
  } catch (e) {
    toast(e.message, 'err');
  } finally { showLoading(false); }
}

// ─── 预览 ───
function openPreview(key, ct) {
  const root = document.getElementById('modal-root');
  const url = API_BASE + '/api/raw?key=' + encodeURIComponent(key) + '&inline=1';
  let body = '';
  if (ct.startsWith('image/')) body = '<img src="' + url + '" alt="">';
  else if (ct === 'application/pdf') body = '<embed src="' + url + '" type="application/pdf">';
  else body = '<iframe src="' + url + '"></iframe>';
  root.innerHTML =
    '<div class="modal-bg" onclick="if(event.target===this)closeModal()">' +
      '<div class="modal wide">' +
        '<h3 style="word-break:break-all;font-size:14px">' + esc(key.split('/').pop()) + '</h3>' +
        '<div class="key-line">' + esc(key) + '</div>' +
        '<div id="preview-body">' + body + '</div>' +
        '<div class="row">' +
          '<button class="spacer" onclick="downloadFile(\\'' + jsq(key) + '\\')">⬇ 下载</button>' +
          '<button onclick="closeModal()">关闭</button>' +
        '</div></div></div>';
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function showLoading(on) { document.getElementById('loading').style.display = on ? 'flex' : 'none'; }
function refreshAll() {
  Promise.all([loadList(currentPrefix), loadCounts(), loadUsage()]);
  toast('已刷新', 'ok');
}

// ═══════════════════ 上传任务系统（后台队列 + 实时进度，不阻塞页面）═══════════════════
const uploads = new Map();   // id -> { id, name, key, size, xhr, state, loaded, error }
const fileBlobs = new Map(); // id -> File 对象
let upSeq = 0;
const PARALLEL_MAX = 3;
let activeCount = 0;

function targetCategory() {
  const m = currentPrefix.match(/^(reports|datasets|downloads|temp)\\//);
  return m ? m[1] : 'reports';
}

// 入口 1：上传弹窗
function openUpload() {
  const root = document.getElementById('modal-root');
  const cats = ['reports', 'datasets', 'downloads', 'temp'];
  root.innerHTML =
    '<div class="modal-bg" onclick="if(event.target===this)closeModal()">' +
      '<div class="modal"><h3>上传文件</h3>' +
        '<p style="margin:-8px 0 14px;font-size:12px;color:var(--muted)">支持多选。上传在后台进行，可以继续浏览。</p>' +
        '<div class="field"><label>分类</label><select id="up-cat">' +
          cats.map(c => '<option value="' + c + '"' + (c === targetCategory() ? ' selected' : '') + '>' + c + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Key 前缀覆盖（可选，高级）</label>' +
          '<input id="up-key" placeholder="留空 = 分类/文件名" style="font-family:var(--mono);font-size:12px"></div>' +
        '<div class="field"><label>文件（可多选）</label><input type="file" id="up-file" multiple></div>' +
        '<div class="row"><button onclick="closeModal()">取消</button>' +
        '<button class="primary" onclick="doUpload()">加入上传队列</button></div>' +
      '</div></div>';
}

function doUpload() {
  const cat = document.getElementById('up-cat').value;
  const keyInput = document.getElementById('up-key').value.trim();
  const files = [...document.getElementById('up-file').files];
  if (files.length === 0) { toast('请选择文件', 'err'); return; }
  files.forEach((f, i) => {
    // 多文件 + 自定义 key：仅对单文件生效，多文件时忽略前缀覆盖避免重名
    const custom = files.length === 1 && keyInput ? keyInput : '';
    const key = custom || (cat + '/' + f.name);
    enqueueUpload(f, key);
  });
  closeModal();
  toast(files.length + ' 个文件已加入队列', 'ok');
}

// 入口 2：拖拽 / 粘贴
function enqueueFiles(files) {
  const cat = targetCategory();
  [...files].forEach(f => enqueueUpload(f, cat + '/' + f.name));
  toast(files.length + ' 个文件已加入队列（' + cat + '/）', 'ok');
}

function enqueueUpload(file, key) {
  const id = 'up' + (++upSeq);
  fileBlobs.set(id, file);
  uploads.set(id, { id, name: file.name, key, size: file.size, xhr: null, state: 'queued', loaded: 0, error: '' });
  renderPanel();
  pumpQueue();
}

function pumpQueue() {
  while (activeCount < PARALLEL_MAX) {
    const next = [...uploads.values()].find(u => u.state === 'queued');
    if (!next) break;
    startUpload(next);
  }
  renderPanel();
}

function startUpload(u) {
  activeCount++;
  u.state = 'uploading';
  const xhr = new XMLHttpRequest();
  u.xhr = xhr;
  xhr.open('PUT', API_BASE + '/api/upload?key=' + encodeURIComponent(u.key));
  if (TOKEN) xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
  xhr.setRequestHeader('Content-Type', guessContentType(u.name));
  xhr.responseType = 'text';
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) { u.loaded = e.loaded; updateItem(u); }
  };
  xhr.onload = () => {
    activeCount--;
    if (xhr.status >= 200 && xhr.status < 300) {
      u.state = 'done'; u.loaded = u.size;
      // 上传完成后刷新当前视图（若用户还在对应目录）
      if (currentPrefix === '' || u.key.startsWith(currentPrefix)) loadList(currentPrefix);
      loadCounts(); loadUsage();
    } else {
      u.state = 'err';
      u.error = 'HTTP ' + xhr.status + ' ' + (xhr.responseText || '').slice(0, 80);
    }
    pumpQueue(); renderPanel();
  };
  xhr.onerror = () => { activeCount--; u.state = 'err'; u.error = '网络错误'; pumpQueue(); renderPanel(); };
  xhr.onabort = () => { activeCount--; u.state = 'canceled'; pumpQueue(); renderPanel(); };
  xhr.send(fileBlobs.get(u.id));
  updateItem(u);
}

function cancelUpload(id) {
  const u = uploads.get(id);
  if (!u) return;
  if (u.state === 'uploading' && u.xhr) u.xhr.abort();
  else { u.state = 'canceled'; renderPanel(); }
}
function retryUpload(id) {
  const u = uploads.get(id);
  if (!u || (u.state !== 'err' && u.state !== 'canceled')) return;
  u.state = 'queued'; u.loaded = 0; u.error = '';
  renderPanel(); pumpQueue();
}
function removeUpload(id) {
  cancelUpload(id);
  uploads.delete(id); fileBlobs.delete(id);
  renderPanel();
}
function clearFinished() {
  [...uploads.values()].forEach(u => {
    if (u.state === 'done' || u.state === 'canceled') { uploads.delete(u.id); fileBlobs.delete(u.id); }
  });
  renderPanel();
}
function togglePanel() {
  const p = document.getElementById('uploadPanel');
  p.classList.toggle('collapsed');
  document.getElementById('upToggleBtn').textContent = p.classList.contains('collapsed') ? '展开' : '收起';
}

// ─── 渲染 ───
function fmtBytes(n) { return humanSize(n); }
function renderPanel() {
  const panel = document.getElementById('uploadPanel');
  if (uploads.size === 0) { panel.classList.remove('show'); return; }
  panel.classList.add('show');
  const list = document.getElementById('upList');
  const doneN = [...uploads.values()].filter(u => u.state === 'done').length;
  const errN = [...uploads.values()].filter(u => u.state === 'err').length;
  document.getElementById('upSummary').textContent =
    (doneN + errN) + '/' + uploads.size + (errN ? ' · ' + errN + ' 失败' : '');
  list.innerHTML = [...uploads.values()].map(u => {
    const pct = u.size ? Math.min(100, Math.round(u.loaded / u.size * 100)) : 0;
    let stateTxt = '', ops = '';
    if (u.state === 'queued') stateTxt = '排队中';
    if (u.state === 'uploading') stateTxt = pct + '%';
    if (u.state === 'done') stateTxt = '✓ 完成';
    if (u.state === 'canceled') stateTxt = '已取消';
    if (u.state === 'err') stateTxt = '✗ 失败';
    if (u.state === 'uploading' || u.state === 'queued') {
      ops = '<button onclick="cancelUpload(\\'' + u.id + '\\')">取消</button>';
    } else if (u.state === 'err' || u.state === 'canceled') {
      ops = '<button onclick="retryUpload(\\'' + u.id + '\\')">重试</button>' +
            '<button onclick="removeUpload(\\'' + u.id + '\\')">移除</button>';
    } else {
      ops = '<button onclick="removeUpload(\\'' + u.id + '\\')">移除</button>';
    }
    return '<div class="upload-item ' + u.state + '" id="ui-' + u.id + '">' +
      '<div class="u-name"><span class="n" title="' + esc(u.key) + '">' + esc(u.name) + '</span><span class="u-state">' + stateTxt + '</span></div>' +
      '<div class="u-sub"><span>' + esc(u.key) + '</span><span>' + (u.size ? fmtBytes(u.loaded) + ' / ' + fmtBytes(u.size) : '') + '</span></div>' +
      '<div class="u-bar"><div style="width:' + (u.state === 'done' ? 100 : pct) + '%"></div></div>' +
      '<div class="u-ops">' + ops + '</div>' +
    '</div>';
  }).join('');
}
function updateItem(u) {
  const el = document.getElementById('ui-' + u.id);
  if (!el) { renderPanel(); return; }
  const pct = u.size ? Math.min(100, Math.round(u.loaded / u.size * 100)) : 0;
  el.querySelector('.u-state').textContent = pct + '%';
  el.querySelector('.u-bar > div').style.width = pct + '%';
  el.querySelector('.u-sub span:last-child').textContent = fmtBytes(u.loaded) + ' / ' + fmtBytes(u.size);
}

// ─── 拖拽上传 ───
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (![...e.dataTransfer.types].includes('Files')) return;
  dragDepth++;
  document.getElementById('dropzone').classList.add('show');
  document.getElementById('dzTarget').textContent = targetCategory();
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.getElementById('dropzone').classList.remove('show');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.getElementById('dropzone').classList.remove('show');
  if (e.dataTransfer.files.length) enqueueFiles(e.dataTransfer.files);
});
// 粘贴图片直接上传
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) enqueueFiles(files);
});

// ─── 搜索（防抖） ───
let searchTimer;
document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchQuery = e.target.value.trim(); loadList(currentPrefix); }, 220);
});

// Esc 关闭模态/抽屉
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); toggleTree(false); }
});

// ─── 启动 ───
nav('');
loadCounts();
loadUsage();
</script>
</body>
</html>`;
