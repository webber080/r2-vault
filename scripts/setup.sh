#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  R2 Vault 一键安装脚本
#
#  做什么：
#   1. 检查依赖（node、wrangler）
#   2. 引导登录 Cloudflare（API Token 方式）
#   3. 创建 R2 bucket、设置 Agent Token
#   4. 部署 Worker + 自定义域名
#   5. 打印后续手工步骤（Cloudflare Access 配置）
#
#  用法：
#   cd worker && bash ../scripts/setup.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${BLUE}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
die()   { echo -e "${RED}✗${NC} $1"; exit 1; }

command -v node >/dev/null || die "需要 Node.js 18+。安装：https://nodejs.org"
command -v npx  >/dev/null || die "需要 npx"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        R2 Vault 安装向导             ║"
echo "║   Cloudflare R2 私人网盘（免费档）   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. 交互收集配置 ──
read -rp "① Cloudflare API Token（需 Workers Scripts:Edit + Workers R2 Storage:Edit 权限）: " CF_TOKEN
[[ -n "$CF_TOKEN" ]] || die "Token 不能为空"

read -rp "② Cloudflare Account ID（dash 右侧栏可查，32 位 hex）: " CF_ACCOUNT
[[ -n "$CF_ACCOUNT" ]] || die "Account ID 不能为空"

read -rp "③ R2 bucket 名（不存在会自动创建，默认 my-vault）: " BUCKET
BUCKET=${BUCKET:-my-vault}

read -rp "④ 浏览器界面域名（如 files.yourdomain.com）: " UI_DOMAIN
[[ -n "$UI_DOMAIN" ]] || die "界面域名不能为空"

read -rp "⑤ API 域名（如 r2.yourdomain.com）: " API_DOMAIN
[[ -n "$API_DOMAIN" ]] || die "API 域名不能为空"

# ── 2. 生成 Agent Token ──
AGENT_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ok "已生成随机 Agent Token"

# ── 3. 写 wrangler.toml ──
info "写入 wrangler.toml ..."
sed -e "s/files.example.com/$UI_DOMAIN/" \
    -e "s/r2.example.com/$API_DOMAIN/" \
    -e "s/bucket_name = \"my-vault\"/bucket_name = \"$BUCKET\"/" \
    wrangler.toml > wrangler.toml.new && mv wrangler.toml.new wrangler.toml
ok "wrangler.toml 已配置"

# ── 4. 创建 R2 bucket ──
info "创建 R2 bucket: $BUCKET ..."
export CLOUDFLARE_API_TOKEN="$CF_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT"
npx wrangler r2 bucket create "$BUCKET" 2>/dev/null && ok "bucket 已创建" || warn "bucket 创建跳过（可能已存在）"

# ── 5. 部署 Worker ──
info "部署 Worker ..."
npx wrangler deploy && ok "Worker 已部署"

# ── 6. 设置 secrets ──
info "设置 AGENT_TOKEN secret ..."
echo "$AGENT_TOKEN" | npx wrangler secret put AGENT_TOKEN >/dev/null && ok "AGENT_TOKEN 已设置"

# ── 7. 保存 token 到本地 ──
mkdir -p "$HOME/.r2-vault"
echo "$AGENT_TOKEN" > "$HOME/.r2-vault/token"
chmod 600 "$HOME/.r2-vault/token"
ok "Agent Token 已保存到 ~/.r2-vault/token（已设 600 权限）"

echo ""
echo -e "${GREEN}══════════════ 部署完成 ══════════════${NC}"
echo ""
echo "Agent Token（也保存在 ~/.r2-vault/token，请妥善保管，不要泄露）:"
echo -e "${YELLOW}$AGENT_TOKEN${NC}"
echo ""
echo "接下来还有 2 步手工配置（5 分钟）："
echo ""
echo "【第 1 步】确认自定义域名生效"
echo "  Worker 会自动为 $UI_DOMAIN 和 $API_DOMAIN 创建 Custom Domain 并签发 SSL。"
echo "  ⚠ 如果报错 100117（域名已有 DNS 记录），先去 dash → DNS 删除这两个域名的旧记录再重跑 deploy。"
echo ""
echo "【第 2 步】配置 Cloudflare Access（保护浏览器界面）"
echo "  详见 docs/setup-access.md —— 配好后把团队域和 AUD 填进来："
echo "    npx wrangler secret put ACCESS_TEAM_DOMAIN   # 如 myteam.cloudflareaccess.com"
echo "    npx wrangler secret put ACCESS_AUD           # Access 应用的 AUD"
echo ""
echo "CLI 使用（把 API_BASE 换成你的 API 域名）:"
echo "  export R2_BASE=https://$API_DOMAIN"
echo "  node cli/r2.js ls"
echo ""
echo "验证部署: node cli/r2-test.js"
