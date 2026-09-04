# Cloudflare Access 配置指南（保护浏览器界面）

Access 是 Cloudflare 免费的零信任登录网关。配置后，只有你允许的邮箱
能在浏览器打开网盘界面——未登录的人会被跳转到登录页。

API 域（Agent 用）**不需要** Access，它靠 Bearer Token 鉴权。

---

## 前置条件

- Worker 已部署（scripts/setup.sh 完成）
- 一个能收邮件的邮箱（用作登录身份）

## 步骤

### 1. 进入 Zero Trust 控制台

打开 https://one.dash.cloudflare.com → 选择你的账户。
首次进入会要求选择套餐 → 选 **Free（50 用户内免费）**。

### 2. 设置登录方式（One-time PIN）

左侧 **Settings → Authentication → Login methods**：
确认列表里有 **One-time PIN**（默认就有，如果没有就 Add new → One-time PIN）。
这是"输入邮箱 → 收验证码"的登录方式，无需注册任何第三方。

### 3. 创建 Access 应用

左侧 **Access → Applications → Add an application → Self-hosted**：

| 字段 | 填什么 |
|---|---|
| Application name | `R2 Vault`（随便起，会显示在登录页标题） |
| Session Duration | 24 hours（默认） |
| Public hostname | Subdomain 填你 UI 域名的前缀（如 `files`），Domain 选你的根域 |

**下一步 Add a policy：**

| 字段 | 填什么 |
|---|---|
| Policy name | `Allow me`（随便起） |
| Action | **Allow** |
| Include → Selector | **Emails** |
| 值 | 你的邮箱（如 `you@gmail.com`） |

要给朋友也开权限？在 Emails 里多填几个，或以后在应用里 Add a policy。
**只允许你信任的邮箱——有权限的人就能看你网盘里所有文件。**

保存。等 1 分钟生效。

### 4. 验证

浏览器无痕窗口打开 `https://<你的UI域名>`：
- ✅ 应跳转到 `<你的团队名>.cloudflareaccess.com` 登录页
- ✅ 输入邮箱收验证码后，能看到网盘界面
- ✅ 换一个不在名单里的邮箱 → 收到码也进不去

### 5. 把 Access 和 Worker 绑定（重要，防伪造）

Worker 需要验证"这个请求真的是通过 Access 进来的"，而不是有人
伪造了一个 Access 头部直接打 API。两步：

**a. 拿到你的团队域**：Zero Trust 控制台首页/Settings 里显示的
`<团队名>.cloudflareaccess.com`（如 `myteam.cloudflareaccess.com`）。

**b. 拿到应用的 AUD**：
登录你的网盘界面后，浏览器 F12 → Application → Cookies →
复制 `CF_Authorization` 的值（一长串），到 https://jwt.io 解码，
payload 里的 `aud` 字段就是（一串 32 位 hex）。

**c. 写入 Worker secrets：**

```bash
cd worker
export CLOUDFLARE_API_TOKEN=<你的Token>
export CLOUDFLARE_ACCOUNT_ID=<你的AccountID>
npx wrangler secret put ACCESS_TEAM_DOMAIN   # 粘贴: myteam.cloudflareaccess.com
npx wrangler secret put ACCESS_AUD           # 粘贴: 解码出的 aud 值
```

设置后浏览器会话自动生效（Worker 会用团队公钥验证每个请求的 JWT 签名）。

### 6. 验证绑定生效

```bash
# 伪造 Access 头部 → 必须 401
curl -H "cf-access-jwt-assertion: fake" https://<你的API域名>/api/list
# 期望: {"error":"Unauthorized"}
```

---

## 常见问题

**Q: 登录页显示 "Log in to xxx" 的 xxx 能改吗？**
能，就是应用名称（步骤 3 的 Application name）。

**Q: 团域名 `<随机词>-<随机码>.cloudflareaccess.com` 能改吗？**
首次创建 Zero Trust 时可自定义一次；创建后不能删，只能将就（登录页会显示它，无碍）。

**Q: 想加/删能访问的人？**
Zero Trust → Access → Applications → 你的应用 → Policies → 编辑。
