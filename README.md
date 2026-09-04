# 🔐 R2 Vault

> 免费 Cloudflare R2 网盘：AI Agent 自动上传 + 私人网页浏览管理

R2 Vault 把 Cloudflare R2（免费 10GB、流量免费）变成一个「AI Agent 协作网盘」：

- **AI Agent 写入**：任何能发 HTTP 请求的 Agent/脚本，用 Bearer Token 直接上传
  代码/报告/数据集/下载的文件
- **你只管审阅**：浏览器打开漂亮的网页界面（Finder 式），浏览、预览、搜索、下载、删除
- **零成本**：R2 免费档 + Workers 免费档（10 万请求/天），无服务器运维

功能一览：图片缩略图、文件预览（图/PDF/文本/HTML）、整页拖拽上传、粘贴上传、
多文件并行上传进度条、存储额度仪表、分类目录、搜索、temp 目录 14 天自动清理、
全尺寸响应式（手机/平板/桌面）。

---

## 架构

```
┌─────────────┐   Bearer Token    ┌──────────────────────┐
│  AI Agents  │ ─────────────────▶ │  Cloudflare Worker   │
│ (任意语言)  │   r2.yourdom.com  │      r2-vault        │
└─────────────┘                   │  · Bearer 鉴权       │
                                  │  · Access JWT 验证   │
┌─────────────┐  Cloudflare Access│  · key 安全校验      │
│  你的浏览器  │ ─────────────────▶│  · 速率/大小限制     │
│ files.your… │   (邮箱验证码登录) └──────────┬───────────┘
└─────────────┘                              │ R2 binding
                                             ▼
                                   ┌──────────────────┐
                                   │   R2 Bucket      │
                                   │  reports/        │
                                   │  datasets/       │
                                   │  downloads/      │
                                   │  temp/ (14天清理)│
                                   └──────────────────┘
```

双域设计（安全边界）：
- **UI 域**（`files.*`）：套 Cloudflare Access（邮箱验证码），只给你自己
- **API 域**（`r2.*`）：纯 Bearer Token，给 Agent 用，不做 Access（Access 是浏览器方案）

Worker 对每个请求做双轨鉴权：`Bearer Token` **或** `验证签名通过的 Access JWT`。
JWT 用 Cloudflare 团队公钥（JWKS）做 RS256 密码学验证——伪造头部直接 401。

---

## 快速开始

### 前置条件
- 一个 Cloudflare 账户（免费即可）+ 一个托管在 CF 的域名
- Node.js 18+
- 一个 Cloudflare API Token（权限：**Workers Scripts:Edit + Workers R2 Storage:Edit**；
  在 dash → My Profile → API Tokens → Create Token → Custom token 创建）

### 一键安装

```bash
git clone https://github.com/<你的用户名>/r2-vault.git
cd r2-vault/worker
bash ../scripts/setup.sh
```

脚本会引导你填 Token/域名，自动完成：生成 Agent Token → 写配置 →
建 bucket → 部署 Worker → 保存 token 到 `~/.r2-vault/token`。

剩下唯一的手工步骤是 **[配置 Cloudflare Access](docs/setup-access.md)**
（约 5 分钟：Zero Trust 控制台点几下 + 两条 `wrangler secret put`）。

### 验证

```bash
cd cli
export R2_BASE=https://r2.yourdomain.com
export R2_TOKEN_FILE=~/.r2-vault/token
node r2.js put hello.txt ./somefile.txt   # 上传
node r2.js ls                              # 列表
node r2-test.js                            # 33 项端到端回归测试
```

浏览器打开 `https://files.yourdomain.com` —— 输入邮箱收验证码即可进入。

---

## Agent 接入（给你的 AI 用）

HTTP API 一览（所有请求需要 `Authorization: Bearer <AGENT_TOKEN>`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| PUT | `/api/upload?key=reports/xxx.json` | 上传，body 是原始字节，`Content-Type` 头可选 |
| GET | `/api/list?prefix=reports/&limit=100` | 列表（分页 cursor） |
| GET | `/api/raw?key=...` | 下载原始字节；`&download=1` 强制 attachment |
| DELETE | `/api/delete?key=...` | 删除（幂等） |
| GET | `/api/usage` | 存储用量（前端额度条数据源） |

curl 示例：

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     --data-binary @report.json \
     "https://r2.yourdomain.com/api/upload?key=reports/2026-09-04.json"
```

Node / Python / 任意 Agent 框架都能直接用 fetch/requests 调用。
配套 CLI（`cli/r2.js`，`put/get/ls/rm/usage/browse`）可作为参考实现。

### 目录约定

Agent 约定把文件放到固定前缀下，方便浏览：

| 前缀 | 用途 |
|---|---|
| `reports/` | Agent 生成的报告、分析结果 |
| `datasets/` | 抓取/整理的数据集 |
| `downloads/` | Agent 下载的文件（PDF、图片等） |
| `temp/` | 临时文件——**每月 1/15 号自动清掉 14 天前的** |

---

## 安全模型

| 层 | 机制 |
|---|---|
| 浏览器入口 | Cloudflare Access：邮箱验证码，白名单邮箱才能进 |
| Agent 入口 | 64 位随机 Bearer Token（常量时间比较，防时序侧信道） |
| JWT 伪造防护 | Worker 用团队 JWKS 公钥验证 Access JWT 的 RS256 签名 + iss + exp + aud；头部存在≠可信 |
| 注入防护 | key 白名单校验（拒绝 `..`、控制字符、超长）；`Content-Disposition` 固定 attachment + ASCII 回退文件名 |
| XSS 防护 | HTML 界面带 CSP（default-src 'none'）；存储型 HTML/SVG 永不 inline 渲染；`nosniff` 全覆盖 |
| 上传限制 | 默认单文件 ≤512MB（可配），x-meta 头数量/长度受限 |
| Token 保存 | `~/.r2-vault/token`，600 权限；secret 存 Workers Secrets，不进代码仓库 |

**API 域没有任何浏览器会话**——它是纯机器接口。浏览器界面只走 UI 域。

---

## 项目结构

```
r2-vault/
├── worker/
│   ├── wrangler.toml          # Worker 配置（域名/桶/cron）
│   └── src/
│       ├── worker.js          # 全部后端逻辑（单文件，约 470 行）
│       └── browser-html.js    # 网页界面（单文件 SPA，无构建步骤）
├── cli/
│   ├── r2.js                  # 命令行客户端（put/get/ls/rm/usage/browse）
│   └── r2-test.js             # 33 项端到端测试套件
├── scripts/
│   └── setup.sh               # 一键安装向导
└── docs/
    └── setup-access.md        # Cloudflare Access 配置指南
```

## 成本

| 项 | 免费额度 | R2 Vault 用量 |
|---|---|---|
| R2 存储 | 10 GB/月 | 按需，仪表实时显示 |
| R2 Class A（写/列） | 100 万次/月 | 低 |
| R2 Class B（读） | 1000 万次/月 | 低 |
| R2 流量（egress） | **免费** | — |
| Workers 请求 | 10 万次/天 | 低 |
| Cloudflare Access | 50 用户 | 1-几个 |

超出 10GB 后 R2 按 $0.015/GB·月 计费——离免费线还很远。

## License

MIT
