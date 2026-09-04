// Cloud Drive 风格单页 HTML — v2
// 设计目标：美观 + 全尺寸响应式（手机 ≤720 / 平板 ≤1024 / 桌面）
// 左：目录树（移动端变抽屉）；右：文件卡片网格；顶：搜索 + 额度 + 操作
// 鉴权：CF Access cookie 优先，回退 localStorage token

export const BROWSER_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#4f6df5">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="R2 Vault">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-192.png">
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

  /* section.files 设为容器查询容器：列表/卡片基于其实际宽度响应，而非视口 */
  section.files { flex: 1; overflow-y: auto; padding: 0 20px 40px; container-type: inline-size; }
  .files-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; padding-top: 18px; flex-wrap: wrap; }
  .files-header h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .files-header .meta { color: var(--muted); font-size: 12px; font-family: var(--mono); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 20cqw, 190px), 1fr)); gap: clamp(10px, 2.5cqw, 14px); }
  /* 列表模式 */
  .grid.list { display: block; }
  .grid.list .card { display: grid; grid-template-columns: 36px 1fr auto auto; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; }
  .grid.list .card:hover { transform: none; }
  .grid.list .card .icon-wrap { height: 36px; width: 36px; min-width: 36px; margin: 0; border-radius: 6px; font-size: 18px; }
  .grid.list .card .name { font-size: 13px; min-height: 0; -webkit-line-clamp: 1; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grid.list .card .meta { display: contents; }
  .grid.list .card .meta > span { color: var(--muted); font-size: 12px; font-family: var(--mono); white-space: nowrap; min-width: 80px; text-align: right; }
  .grid.list .card .meta > span:first-child { min-width: 70px; }
  /* 列表模式：完整 Windows 风格表格 */
  .grid.list { display: block; }
  .list-header,
  .grid.list .card {
    display: grid;
    grid-template-columns: 28px minmax(120px, 1fr) 170px 110px 90px;
    align-items: center; gap: 12px; padding: 8px 12px;
    border-radius: 6px;
  }
  /* 列头容器：作为 section.files 直接子元素，sticky 吸顶；负 margin 抵消父容器 padding-top 的留白 */
  #listHeader { position: sticky; top: 0; z-index: 2; margin: 0 -20px; padding: 0 20px; }
  #listHeader:empty { display: none; }
  .list-header {
    background: var(--bg); border-bottom: 1px solid var(--border);
    color: var(--muted); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .04em;
    cursor: default; user-select: none;
  }
  .list-header .col { display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 4px 0; white-space: nowrap; overflow: hidden; }
  .list-header .col:hover { color: var(--accent); }
  .list-header .col .arrow { font-size: 9px; opacity: .6; flex: none; }
  .list-header .col.active { color: var(--accent); }
  .list-header .col.right { justify-content: flex-end; text-align: right; }
  .grid.list { padding-top: 6px; }
  .grid.list .card { margin-bottom: 2px; transition: background .12s; }
  .grid.list .card .icon-wrap { width: 28px; height: 28px; min-width: 28px; border-radius: 4px; font-size: 16px; margin: 0; background: transparent; }
  .grid.list .card .name { font-size: 13px; min-height: 0; -webkit-line-clamp: 1; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grid.list .card .col { font-size: 12px; color: var(--muted); font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grid.list .card .col.right { text-align: right; }
  .grid.list .card .col.type { color: var(--muted); }
  .grid.list .card:hover { background: #f4f6fc; }
  .grid.list .card.selected { background: #e9efff; border-color: #b3c2ff; }
  .grid.list .card.selected .col { color: #2c3a66; }
  /* 列表模式触屏长按 60ms 提示选中 */
  .grid.list .card.press { background: #e9efff; }

  /* 列表表格基于容器宽度响应：窄容器隐藏类型列，收窄列宽（容器查询比媒体查询更准，不受侧栏开合影响） */
  @container (max-width: 900px) {
    .list-header, .grid.list .card { grid-template-columns: 24px minmax(60px, 1fr) 78px 62px; gap: 8px; padding: 8px 10px; }
    .list-header .col.type, .grid.list .card .col.type { display: none; }
    .list-header .col.size, .grid.list .card .col.size { min-width: 56px; }
  }
  @container (max-width: 620px) {
    /* 很窄容器：进一步收窄日期列，保证大小列可读 */
    .list-header, .grid.list .card { grid-template-columns: 22px minmax(52px, 1fr) 74px 58px; gap: 6px; padding: 7px 8px; }
    .list-header .col, .grid.list .card .col { font-size: 11px; }
  }
  /* 卡片网格基于容器宽度分档列数（默认 auto-fill 自适应，此处约束最小/最大列宽） */
  @container (max-width: 480px) {
    .grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .card .icon-wrap { height: 84px; font-size: 30px; }
  }
  /* grid 模式下也支持选中态（点击 = 预览不变，selected 加边框提示） */
  .grid:not(.list) .card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(79,109,245,.18); }

  /* 选中操作栏（顶部"已选 N 项"） */
  .selection-bar {
    display: flex; align-items: center; gap: 12px;
    background: linear-gradient(135deg, #eef1fe, #e1e8ff);
    border: 1px solid #c8d0f0; border-radius: 10px;
    padding: 10px 14px; margin-bottom: 12px; font-size: 13px;
    animation: sel-fade .2s ease-out;
  }
  .selection-bar .label { color: #3b4a8c; font-weight: 600; }
  .selection-bar .grow { flex: 1; }
  .selection-bar button { min-height: 32px; padding: 4px 12px; font-size: 12px; }
  .selection-bar .close { background: transparent; border: 0; color: #6b7593; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 6px; }
  @keyframes sel-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

  /* 右键菜单 */
  .context-menu {
    position: fixed; z-index: 9999; min-width: 180px;
    background: #fff; border: 1px solid var(--border); border-radius: 10px;
    box-shadow: 0 12px 40px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.06);
    padding: 4px; font-size: 13px;
    animation: ctx-fade .12s ease-out;
  }
  .context-menu .item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 6px; cursor: pointer;
    color: var(--fg);
  }
  .context-menu .item:hover { background: #f0f3fc; }
  .context-menu .item.danger { color: #c0392b; }
  .context-menu .item.danger:hover { background: #fce9e6; }
  .context-menu .sep { height: 1px; background: var(--border); margin: 4px 6px; }
  .context-menu .shortcut { margin-left: auto; color: var(--muted); font-size: 11px; }
  @keyframes ctx-fade { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
  .view-toggle { display: inline-flex; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 2px; gap: 2px; }
  .view-toggle button { background: transparent; border: 0; padding: 5px 10px; min-height: 30px; border-radius: 6px; cursor: pointer; color: var(--muted); font-size: 14px; line-height: 1; font-family: inherit; }
  .view-toggle button.active { background: var(--accent); color: #fff; }
  .files-header { gap: 10px; }
  .files-header .right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
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
  .card .name { font-weight: 600; font-size: 13px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
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
  /* 平板 ≤1024：搜索收窄（卡片网格列宽由容器查询负责） */
  @media (max-width: 1024px) {
    .search { width: 190px; }
    .logo .badge { display: none; }
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
    section.files { padding: 0 12px 40px; }
    #listHeader { margin: 0 -12px; padding: 0 12px; }
    .card .icon-wrap { height: 88px; font-size: 32px; }
  }
  /* 小手机 ≤400：仅隐藏顶栏标题（卡片网格列宽由容器查询负责） */
  @media (max-width: 400px) {
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
      <div class="right">
        <span class="meta" id="current-meta"></span>
        <div class="view-toggle" role="tablist" aria-label="视图模式">
          <button id="view-grid" type="button" role="tab" aria-label="平铺" title="平铺视图">▦</button>
          <button id="view-list" type="button" role="tab" aria-label="列表" title="列表视图">☰</button>
        </div>
      </div>
    </div>
    <div id="listHeader"></div>
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
// 同源调用：<UI 域名>/api/*，CF Access cookie 自动携带
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
        <input id="token-input" type="password" placeholder="访问令牌（32 位 hex）" autocomplete="current-password" autocapitalize="off" spellcheck="false"
          style="width:100%;padding:12px 14px;min-height:44px;border:1px solid #e6e9f0;border-radius:10px;font-family:ui-monospace,Menlo,monospace;font-size:14px;letter-spacing:.5px;outline:none">
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="testToken()" id="test-btn" style="flex:1;min-height:46px;background:#fff;color:#4f6df5;border:1px solid #c8d0f0;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer">测试</button>
          <button onclick="saveToken()" id="enter-btn" style="flex:2;min-height:46px;background:linear-gradient(135deg,#4f6df5,#3b55e0);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer">进入</button>
        </div>
        <p id="token-msg" style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#9aa1b5;text-align:center;min-height:18px"></p>
      </div>
    </div>\`;
  window.testToken = async () => {
    const v = document.getElementById('token-input').value.trim();
    const msg = document.getElementById('token-msg');
    const testBtn = document.getElementById('test-btn');
    if (!v) { msg.style.color = '#d04'; msg.textContent = '请先粘贴令牌'; return; }
    testBtn.disabled = true; testBtn.textContent = '测试中…';
    msg.style.color = '#69718a'; msg.textContent = '正在验证令牌…';
    try {
      const r = await fetch('/api/usage?token=' + encodeURIComponent(v));
      if (r.ok) {
        msg.style.color = '#0a8a4a';
        msg.textContent = '✓ 令牌有效，存储用量接口返回成功。点"进入"。';
        testBtn.textContent = '✓ 有效'; testBtn.style.color = '#0a8a4a';
      } else {
        msg.style.color = '#d04';
        msg.textContent = '✗ ' + r.status + ' 令牌无效或已吊销，请检查后重试。';
        testBtn.textContent = '测试'; testBtn.style.color = '#4f6df5';
      }
    } catch (e) {
      msg.style.color = '#d04';
      msg.textContent = '✗ 网络错误：' + e.message;
      testBtn.textContent = '测试'; testBtn.style.color = '#4f6df5';
    } finally {
      testBtn.disabled = false;
    }
  };
  window.saveToken = () => {
    const v = document.getElementById('token-input').value.trim();
    if (!v) return;
    localStorage.setItem('r2_token', v);
    location.reload();
  };
  document.getElementById('token-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') testToken();
  });
  throw new Error('awaiting token');
}

// ─── 状态 ───
let currentPrefix = '';
let searchQuery = '';
let VIEW_MODE = localStorage.getItem('r2_view') || 'grid';
let SORT_BY = localStorage.getItem('r2_sort_by') || 'date';  // 'name'|'date'|'size'|'type'
let SORT_DIR = localStorage.getItem('r2_sort_dir') || 'desc'; // 'asc'|'desc'
let selectedKeys = new Set();  // 多选
let pressTimer = null;  // 长按检测
window.setViewMode = (m) => { VIEW_MODE = m; localStorage.setItem('r2_view', m); document.getElementById('view-grid').classList.toggle('active', m==='grid'); document.getElementById('view-list').classList.toggle('active', m==='list'); loadList(currentPrefix); };

// ─── API ───
async function api(path, opts = {}) {
  opts.headers = Object.assign({}, opts.headers);
  if (TOKEN && !opts.headers['Authorization']) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
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
function humanType(key, ct) {
  // 先用 R2 元数据 content-type；缺失时用文件扩展名兜底推断（R2 上传常不设 MIME）
  ct = (ct || '').toLowerCase();
  const map = {
    'image/jpeg': 'JPEG 图片', 'image/jpg': 'JPEG 图片', 'image/png': 'PNG 图片',
    'image/gif': 'GIF 图片', 'image/webp': 'WebP 图片', 'image/svg+xml': 'SVG 矢量图', 'image/bmp': 'BMP 图片', 'image/x-icon': '图标',
    'application/pdf': 'PDF 文档',
    'application/zip': 'ZIP 压缩包', 'application/x-tar': 'TAR 压缩包', 'application/gzip': 'GZ 压缩包', 'application/x-7z-compressed': '7Z 压缩包',
    'application/json': 'JSON 数据',
    'text/csv': 'CSV 表格', 'text/tab-separated-values': 'TSV 表格',
    'text/html': 'HTML 网页', 'text/plain': '纯文本', 'text/markdown': 'Markdown 文本',
    'video/mp4': 'MP4 视频', 'video/webm': 'WebM 视频', 'video/quicktime': 'MOV 视频',
    'audio/mpeg': 'MP3 音频', 'audio/mp4': 'M4A 音频', 'audio/wav': 'WAV 音频', 'audio/flac': 'FLAC 音频', 'audio/ogg': 'OGG 音频',
    'application/javascript': 'JavaScript', 'application/x-python': 'Python 脚本',
  };
  if (ct && map[ct]) return map[ct];
  // 扩展名兜底
  const k = (key || '').toLowerCase();
  const typeByExt = {
    'jpg': 'JPEG 图片', 'jpeg': 'JPEG 图片', 'png': 'PNG 图片', 'gif': 'GIF 图片', 'webp': 'WebP 图片', 'svg': 'SVG 矢量图', 'bmp': 'BMP 图片', 'ico': '图片',
    'pdf': 'PDF 文档',
    'zip': 'ZIP 压缩包', 'tar': 'TAR 压缩包', 'gz': 'GZ 压缩包', '7z': '7Z 压缩包', 'rar': 'RAR 压缩包',
    'json': 'JSON 数据',
    'csv': 'CSV 表格', 'tsv': 'TSV 表格', 'xlsx': 'Excel 表格', 'xls': 'Excel 表格',
    'html': 'HTML 网页', 'htm': 'HTML 网页', 'md': 'Markdown 文本', 'txt': '纯文本', 'log': '日志文本',
    'mp4': 'MP4 视频', 'webm': 'WebM 视频', 'mov': 'MOV 视频', 'avi': 'AVI 视频', 'mkv': 'MKV 视频',
    'mp3': 'MP3 音频', 'm4a': 'M4A 音频', 'wav': 'WAV 音频', 'flac': 'FLAC 音频', 'ogg': 'OGG 音频',
    'js': 'JavaScript', 'mjs': 'JavaScript', 'ts': 'TypeScript', 'py': 'Python 脚本', 'sh': 'Shell 脚本', 'rs': 'Rust', 'go': 'Go', 'java': 'Java', 'c': 'C 源码', 'cpp': 'C++', 'h': '头文件',
    'doc': 'Word 文档', 'docx': 'Word 文档', 'pages': 'Pages 文档',
    'ppt': 'PPT 演示', 'pptx': 'PPT 演示', 'key': 'Keynote',
    'parquet': 'Parquet 数据', 'sql': 'SQL', 'yaml': 'YAML', 'yml': 'YAML', 'toml': 'TOML', 'xml': 'XML', 'ini': '配置',
    'apk': 'APK 应用', 'dmg': '磁盘镜像', 'iso': '系统镜像', 'exe': '可执行文件',
  };
  const ext = k.split('.').pop();
  if (ext && typeByExt[ext]) return typeByExt[ext];
  if (ct && ct.split('/').pop()) return ct.split('/').pop().toUpperCase();
  return ext ? ext.toUpperCase() : '文件';
}
function humanSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n/1048576).toFixed(1) + ' MB';
  return (n/1073741824).toFixed(2) + ' GB';
}
function formatDate(iso) {
  // Windows Explorer 风格：桌面 YYYY-MM-DD HH:MM，移动端紧凑 MM-DD HH:MM
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  const compact = window.innerWidth <= 900;
  const ym = compact
    ? pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  return ym + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
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
    // 排序
    objs.sort((a, b) => {
      let av, bv, cmp;
      switch (SORT_BY) {
        case 'name': av = a.key.toLowerCase(); bv = b.key.toLowerCase(); cmp = av < bv ? -1 : av > bv ? 1 : 0; break;
        case 'size': cmp = a.size - b.size; break;
        case 'type': cmp = (a.httpMetadata.contentType || '').localeCompare(b.httpMetadata.contentType || ''); break;
        case 'date': default: cmp = new Date(a.uploaded) - new Date(b.uploaded); break;
      }
      return SORT_DIR === 'asc' ? cmp : -cmp;
    });
    const grid = document.getElementById('grid');
    grid.className = VIEW_MODE === 'list' ? 'grid list' : 'grid';
    // 非列表模式或空集时清空列头容器
    if (VIEW_MODE !== 'list' || objs.length === 0) document.getElementById('listHeader').innerHTML = '';
    if (objs.length === 0) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">🪣</div>' + (searchQuery ? '没有匹配的文件' : '此目录为空') + '</div>';
    } else if (VIEW_MODE === 'list') {
      // 列表模式：列头 + 行（无 inline 按钮）
      const arrow = d => d === 'asc' ? '↑' : '↓';
      const headCol = (col, label, align) => {
        const active = SORT_BY === col;
        // class 同时带 col 标识（type/size）与右对齐，供媒体查询隐藏
        return '<div class="col ' + col + ' ' + (align || '') + (active ? ' active' : '') + '" data-sort="' + col + '">' +
          '<span>' + label + '</span><span class="arrow">' + (active ? arrow(SORT_DIR) : '') + '</span></div>';
      };
      const header = '<div class="list-header">' +
        '<div></div>' + headCol('name', '名称') + headCol('date', '修改时间') + headCol('type', '类型', 'right') + headCol('size', '大小', 'right') +
      '</div>';
      // 把列头放到滚动容器直接子元素（#listHeader），使 sticky 能吸到 section.files 顶部
      document.getElementById('listHeader').innerHTML = header;
      const rows = objs.map(o => {
        const ic = fileIcon(o.key, o.httpMetadata.contentType);
        // 图片类型：显示缩略图（与平铺模式一致）；其他类型用 emoji
        const icon = (typeof ic === 'string')
          ? ic
          : '<img src="' + rawUrl(o.key, '&inline=1') + '" loading="lazy" alt="">';
        const name = o.key.split('/').pop();
        const sel = selectedKeys.has(o.key) ? ' selected' : '';
        return '<div class="card' + sel + '" tabindex="0" data-key="' + esc(o.key) + '"' +
          ' onclick="onFileClick(event, this.dataset.key)"' +
          ' ondblclick="onFileDblClick(this.dataset.key)"' +
          ' oncontextmenu="onFileRightClick(event, this.dataset.key)"' +
          ' ontouchstart="onTouchStart(event, this.dataset.key)"' +
          ' ontouchend="onTouchEnd(event)"' +
          ' ontouchmove="onTouchEnd(event)">' +
          '<div class="icon-wrap">' + icon + '</div>' +
          '<div class="name" title="' + esc(o.key) + '">' + esc(name) + '</div>' +
          '<div class="col">' + formatDate(o.uploaded) + '</div>' +
          '<div class="col type right">' + esc(humanType(o.key, o.httpMetadata.contentType)) + '</div>' +
          '<div class="col size right">' + humanSize(o.size) + '</div>' +
        '</div>';
      }).join('');
      grid.innerHTML = rows;
      // 列头点击切换排序
      document.getElementById('listHeader').querySelectorAll('.list-header .col').forEach(c => {
        c.addEventListener('click', () => {
          const col = c.dataset.sort;
          if (SORT_BY === col) SORT_DIR = SORT_DIR === 'asc' ? 'desc' : 'asc';
          else { SORT_BY = col; SORT_DIR = (col === 'name' || col === 'type') ? 'asc' : 'desc'; }
          localStorage.setItem('r2_sort_by', SORT_BY);
          localStorage.setItem('r2_sort_dir', SORT_DIR);
          loadList(currentPrefix);
        });
      });
    } else {
      // 平铺模式：保留原结构（带 inline 按钮）
      grid.innerHTML = objs.map(o => {
        const ic = fileIcon(o.key, o.httpMetadata.contentType);
        const name = o.key.split('/').pop();
        const thumb = ic.type === 'img'
          ? '<img src="' + rawUrl(o.key, '&inline=1') + '" loading="lazy" alt="">'
          : ic;
        const sel = selectedKeys.has(o.key) ? ' selected' : '';
        return '<div class="card' + sel + '" tabindex="0" data-key="' + esc(o.key) + '"' +
          ' onclick="onFileClick(event, this.dataset.key)"' +
          ' ondblclick="onFileDblClick(this.dataset.key)"' +
          ' oncontextmenu="onFileRightClick(event, this.dataset.key)"' +
          ' ontouchstart="onTouchStart(event, this.dataset.key)"' +
          ' ontouchend="onTouchEnd(event)"' +
          ' ontouchmove="onTouchEnd(event)">' +
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
function rawUrl(key, extra) {
  let u = API_BASE + '/api/raw?key=' + encodeURIComponent(key) + (extra || '');
  if (TOKEN) u += '&token=' + encodeURIComponent(TOKEN);
  return u;
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
// 单击：选中（list 模式）或预览（grid 模式）
// 双击：预览
// 右键 / 长按：弹出菜单
function onFileClick(e, key) {
  // Ctrl/Cmd 多选
  if (e && (e.ctrlKey || e.metaKey)) {
    toggleSelect(key);
  } else if (e && e.shiftKey && lastSelectedKey) {
    // 范围选择
    const cards = [...document.querySelectorAll('#grid .card')];
    const i1 = cards.findIndex(c => c.dataset.key === lastSelectedKey);
    const i2 = cards.findIndex(c => c.dataset.key === key);
    if (i1 >= 0 && i2 >= 0) {
      const [a, b] = i1 < i2 ? [i1, i2] : [i2, i1];
      selectedKeys.clear();
      for (let i = a; i <= b; i++) selectedKeys.add(cards[i].dataset.key);
      updateSelectedDom();
    }
  } else {
    // 单选
    if (selectedKeys.size === 1 && selectedKeys.has(key)) {
      // 再次点击同一个 → 预览
      openFile(key);
    } else {
      selectedKeys.clear();
      selectedKeys.add(key);
      lastSelectedKey = key;
      updateSelectedDom();
    }
  }
}
function onFileDblClick(key) {
  openFile(key);
}
function openFile(key) {
  const ct = guessContentType(key);
  if (ct.startsWith('image/') || ct === 'application/pdf' || ct.startsWith('text/') || ct.startsWith('video/') || ct.startsWith('audio/')) openPreview(key, ct);
  else downloadFile(key);
}
function toggleSelect(key) {
  if (selectedKeys.has(key)) selectedKeys.delete(key);
  else selectedKeys.add(key);
  lastSelectedKey = key;
  updateSelectedDom();
}
function clearSelection() {
  if (selectedKeys.size === 0) return;
  selectedKeys.clear();
  updateSelectedDom();
  hideContextMenu();
}
function updateSelectedDom() {
  document.querySelectorAll('#grid .card').forEach(c => {
    c.classList.toggle('selected', selectedKeys.has(c.dataset.key));
  });
  renderSelectionBar();
}
function renderSelectionBar() {
  let bar = document.getElementById('selBar');
  if (selectedKeys.size === 0) {
    if (bar) bar.remove();
    return;
  }
  let totalSize = 0;
  document.querySelectorAll('#grid .card').forEach(c => {
    if (selectedKeys.has(c.dataset.key)) {
      const sizeText = c.querySelector('.col.size')?.textContent || c.querySelector('.meta span')?.textContent || '';
      totalSize += parseSizeText(sizeText);
    }
  });
  const html = '<div class="selection-bar" id="selBar">' +
    '<span class="label">已选 ' + selectedKeys.size + ' 项</span>' +
    '<span style="color:var(--muted)">· ' + humanSize(totalSize) + '</span>' +
    '<div class="grow"></div>' +
    (selectedKeys.size === 1 ? '<button onclick="openFile(\\'' + jsq([...selectedKeys][0]) + '\\')">预览</button>' : '') +
    '<button onclick="downloadSelected()">下载</button>' +
    '<button class="danger" onclick="deleteSelected()">删除</button>' +
    '<button class="close" onclick="clearSelection()" title="取消选择">✕</button>' +
  '</div>';
  const files = document.querySelector('.files-header');
  if (bar) bar.outerHTML = html;
  else files.insertAdjacentHTML('beforebegin', html);
  // 新建 bar 没有事件，需要 attach
  const newBar = document.getElementById('selBar');
  if (newBar) {
    newBar.querySelector('.close').onclick = clearSelection;
    const downloadBtn = [...newBar.querySelectorAll('button')].find(b => b.textContent === '下载');
    if (downloadBtn) downloadBtn.onclick = downloadSelected;
    const deleteBtn = [...newBar.querySelectorAll('button')].find(b => b.textContent === '删除');
    if (deleteBtn) deleteBtn.onclick = deleteSelected;
    const previewBtn = [...newBar.querySelectorAll('button')].find(b => b.textContent === '预览');
    if (previewBtn) previewBtn.onclick = () => openFile([...selectedKeys][0]);
  }
}
function parseSizeText(t) {
  t = (t || '').trim();
  const m = t.match(/([\\d.]+)\\s*(B|KB|MB|GB)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = m[2];
  return n * (u === 'GB' ? 1073741824 : u === 'MB' ? 1048576 : u === 'KB' ? 1024 : 1);
}
function downloadSelected() {
  for (const k of selectedKeys) downloadFile(k);
}
async function deleteSelected() {
  if (selectedKeys.size === 0) return;
  if (!confirm('确定删除 ' + selectedKeys.size + ' 个文件？此操作不可恢复。')) return;
  showLoading(true);
  for (const k of selectedKeys) {
    try { await api('/api/delete?key=' + encodeURIComponent(k), { method: 'DELETE' }); }
    catch (e) { toast('删除失败：' + k + ' ' + e.message, 'err'); }
  }
  selectedKeys.clear();
  await Promise.all([loadList(currentPrefix), loadCounts(), loadUsage()]);
  showLoading(false);
}
let lastSelectedKey = null;
function onFileRightClick(e, key) {
  e.preventDefault();
  // 选中当前（如果未选）
  if (!selectedKeys.has(key)) {
    selectedKeys.clear();
    selectedKeys.add(key);
    lastSelectedKey = key;
    updateSelectedDom();
  }
  showContextMenu(e.clientX, e.clientY, key);
}
function showContextMenu(x, y, key) {
  hideContextMenu();
  const items = [
    { icon: '👁', label: '预览', act: 'open' },
    { icon: '⬇', label: '下载', act: 'download' },
    { sep: true },
    { icon: '🔗', label: '复制链接', act: 'copy' },
    { icon: '📋', label: '复制 key', act: 'copykey' },
    { sep: true },
    { icon: '🗑', label: '删除', act: 'delete', danger: true },
  ];
  const html = '<div class="context-menu" id="ctxMenu" style="left:' + Math.min(x, window.innerWidth - 200) + 'px;top:' + Math.min(y, window.innerHeight - 240) + 'px">' +
    items.map(i => {
      if (i.sep) return '<div class="sep"></div>';
      return '<div class="item ' + (i.danger ? 'danger' : '') + '" data-act="' + i.act + '">' +
        '<span>' + i.icon + '</span><span>' + i.label + '</span></div>';
    }).join('') +
  '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
  const menu = document.getElementById('ctxMenu');
  menu.querySelectorAll('.item').forEach(el => {
    el.onclick = () => {
      const act = el.dataset.act;
      const k = [...selectedKeys][0];
      hideContextMenu();
      if (act === 'open') openFile(k);
      else if (act === 'download') downloadFile(k);
      else if (act === 'copy') { navigator.clipboard.writeText(rawUrl(k, '')); toast('已复制链接', 'ok'); }
      else if (act === 'copykey') { navigator.clipboard.writeText(k); toast('已复制 key: ' + k.split('/').pop(), 'ok'); }
      else if (act === 'delete') deleteSelected();
    };
  });
  // 点击外部关闭（统一走全局处理器，见下方 handleGlobalClick）
  setTimeout(() => {
    document.addEventListener('contextmenu', hideContextMenu, { once: true });
  }, 10);
}
function hideContextMenu() {
  const m = document.getElementById('ctxMenu');
  if (m) m.remove();
}
// 全局空白点击：点击卡片/工具条/菜单之外的区域 → 关闭菜单 + 清除选中（含工具条）
function handleGlobalClick(e) {
  const t = e.target;
  // 点击在卡片内部：不干扰（有独立 onClick/oncontextmenu）
  if (t.closest('.card')) { hideContextMenu(); return; }
  // 点击在工具条/菜单内部：不清除选中
  if (t.closest('.selection-bar') || t.closest('.context-menu')) return;
  // 其余：关闭菜单 + 清除选中
  hideContextMenu();
  clearSelection();
}
document.addEventListener('click', handleGlobalClick);
// 触屏长按 = 右键
function onTouchStart(e, key) {
  pressTimer = setTimeout(() => {
    const t = e.touches[0];
    onFileRightClick({ preventDefault: () => e.preventDefault(), clientX: t.clientX, clientY: t.clientY }, key);
  }, 500);
}
function onTouchEnd() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
}
// Esc 关闭菜单/清除选择
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hideContextMenu(); clearSelection(); }
  // Cmd/Ctrl+A 全部选中（仅 list 模式）
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && VIEW_MODE === 'list') {
    e.preventDefault();
    document.querySelectorAll('#grid .card').forEach(c => selectedKeys.add(c.dataset.key));
    updateSelectedDom();
  }
});
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
  a.href = rawUrl(key, '&download=1');
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
  const url = rawUrl(key, '&inline=1');
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
document.getElementById('view-grid').classList.toggle('active', VIEW_MODE === 'grid');
document.getElementById('view-list').classList.toggle('active', VIEW_MODE === 'list');
document.getElementById('view-grid').onclick = () => window.setViewMode('grid');
document.getElementById('view-list').onclick = () => window.setViewMode('list');

// ─── PWA Service Worker 注册 ───
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
</script>
</body>
</html>`;
