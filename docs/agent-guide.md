# R2 Vault — AI Agent 存储使用指南

## 你的身份与凭证
- 每台服务器已配置好凭证：`~/.r2-vault/token`（Bearer Token，600 权限）
- API 入口：`https://api.yourdomain.com`
- 可选 CLI：`~/.local/bin/r2`（零依赖 Node 单文件）

## 目录约定（必须遵守）
| 前缀 | 用途 | 说明 |
|---|---|---|
| `temp/` | 临时文件 | 每月 1/15 号自动清掉 14 天前的，别放重要文件 |
| `reports/` | 你生成的报告/分析结果 | 长期保留 |
| `datasets/` | 抓取/整理的数据 | 长期保留 |
| `downloads/` | 你下载的文件（PDF/图片等） | 长期保留 |

## 方式一：CLI（推荐，最省事）
```bash
export R2_BASE=https://api.yourdomain.com        # 建议写进 ~/.bashrc（已写）

r2 put /path/local.pdf reports/report.pdf     # 上传（key 可省略→uploads/文件名）
r2 get reports/report.pdf /tmp/out.pdf        # 下载
r2 ls reports/                                 # 列目录
r2 ls temp/ 100                                # 列前 100 条
r2 rm reports/old.pdf                          # 删除（幂等）
r2 usage                                       # 存储用量
r2 browse                                      # 打开浏览器界面（仅桌面机）
```

## 方式二：裸 HTTP（任何语言/框架都能用）
所有请求带 `Authorization: Bearer <token>`，token 从 `~/.r2-vault/token` 读。

```bash
TOKEN=$(cat ~/.r2-vault/token); BASE=https://api.yourdomain.com

# 上传（body = 原始字节）
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/pdf" \
     --data-binary @file.pdf "$BASE/api/upload?key=downloads/file.pdf"

# 列表
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/list?prefix=reports/"

# 下载原始字节
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/raw?key=reports/x.pdf" -o out.pdf

# 删除（幂等）
curl -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/api/delete?key=reports/x.pdf"

# 用量
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/usage"
```

Python:
```python
import os, urllib.request
token = open(os.path.expanduser('~/.r2-vault/token')).read().strip()
BASE = 'https://api.yourdomain.com'
def api(path, method='GET', data=None, ct='application/octet-stream'):
    req = urllib.request.Request(BASE + path, method=method, data=data,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': ct})
    return urllib.request.urlopen(req)
api('/api/upload?key=temp/hello.txt', 'PUT', b'hello', 'text/plain').read()
```

## 硬性规则
1. **key 不能**以 `/` 开头/结尾、含 `..`、含控制字符、超 900 字符
2. 单文件默认上限 512MB（413 = 超了）
3. 空间只有 10GB——上传前 `r2 usage` 看一眼，别把免费额度打爆
4. 删除不可恢复；只删你自己创建的 key
5. token 等同网盘完全控制权——**不要**写进代码仓库、日志或发给任何人

## 出错速查
| 状态 | 含义 |
|---|---|
| 401 | token 错/没带——检查 `~/.r2-vault/token` 与 Authorization 头 |
| 400 | key 非法（见硬性规则 1）或参数缺失 |
| 413 | 文件超过 512MB |
| 404 | key 不存在（list 先确认） |
| 5xx | 服务端问题，稍后重试 |
