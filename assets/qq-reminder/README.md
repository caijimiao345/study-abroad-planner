# QQ 留学提醒系统（可部署模板）

给留学申请配一个**能自己说话的 QQ 群**：前端填提醒（类型 / 目标日期 / 提前 N 天 / 每天·每周·每月），每天北京时间 08:00 把「今日待办清单」推进群里；`study-abroad-planner` 的定时监控任务发现截止日/签证政策变更时，把简报也转发进同一个群。

全部跑在 Cloudflare 免费额度内（Workers + Pages + D1 + KV），零服务器成本、无需公网 IP、无需备案。

> 本目录是**模板**：代码可直接用，但 `wrangler.toml` 里全是 `<REPLACE_*>` 占位符，必须先按下面步骤填真实值。
> 完整集成说明（含验收清单与踩坑记录）见技能内 `../../references/qq-reminder.md`。

---

## 架构

```
study-abroad-planner 定时监控任务 ──简报──▶ POST /api/push（网关，Bearer 令牌）
                                              │
CF Pages 前端（浏览器填提醒）──▶ /api/reminders ─▶ CF Worker ─▶ D1（提醒/已发/日志）
                                              │
CF Workers Cron（每天 UTC 00:00）──扫窗口期──▶ 今日待办清单 ──▶ QQ 群
                                              ▲
                                     KV 缓存 access_token
```

**关键设计**：前端不直连 Worker，而是经 **Pages Functions 反代** `/api/*` 同源转发。这不是洁癖——国内网络下 `*.workers.dev` 常被 DNS 污染而不可达，`*.pages.dev` 可达，走代理等于顺带解决可达性。

## 目录结构

```
qq-reminder/
├── wrangler.toml               # Worker 配置（D1/KV/cron/变量）—— 部署前填 <REPLACE_*>
├── schema.sql                  # D1 表结构（reminders / sent_log / push_log），幂等可重复执行
├── src/index.js                # Worker：REST API + cron 扫描 + QQ 网关
├── functions/api/[[path]].js   # Pages 反代：/api/* → Worker（必须在**项目根**，不能放静态目录内）
├── web/                        # 前端静态资源（Pages 托管）
│   ├── index.html
│   ├── app.js
│   └── style.css
└── .github/workflows/deploy.yml  # 可选：push 到 main 自动部署
```

## 前置条件

- Cloudflare 账号（免费版即可）
- Node 20+ 与本机 `wrangler`（`npx wrangler` 亦可）
- 一个 **QQ 机器人**：在 QQ 开放平台创建，拿到 `AppID` + `AppSecret`；机器人已加入目标群
- 免登录即可用的 `wrangler` 凭据（首次 `wrangler whoami` 会引导浏览器授权）

## 部署步骤

### 1. 建 D1 并建表

```bash
wrangler d1 create qq-reminder                 # 记下返回的 database_id
# 填入 wrangler.toml 的 <REPLACE_D1_DATABASE_ID>
wrangler d1 execute qq-reminder --remote --file=schema.sql
wrangler d1 execute qq-reminder --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### 2. 建 KV（token 缓存）

```bash
wrangler kv namespace create QQ_TOKEN_KV
wrangler kv namespace create QQ_TOKEN_KV --preview
# 两个 id 分别填入 <REPLACE_KV_NAMESPACE_ID> / <REPLACE_KV_PREVIEW_ID>
```

### 3. 填变量

`wrangler.toml` 的 `[vars]`：`QQ_APP_ID`、`QQ_GROUP_OPENID`（第 6 步拿到）、`ALLOWED_ORIGIN`（第 8 步拿到）。

### 4. 注入三个 Secret

```bash
wrangler secret put QQ_APP_SECRET        # QQ 机器人的 AppSecret
wrangler secret put FRONTEND_TOKEN       # 页面登录口令，自定义（建议长随机串或几组短词连字符）
wrangler secret put PUSH_GATEWAY_TOKEN   # 网关令牌，给定时任务用，与上者不同
```

### 5. 部署 Worker

```bash
wrangler deploy
# 记下 Worker 地址 https://<name>.<子域>.workers.dev（**不要**拿它做国内访问验证）
```

### 6. 抓 `group_openid`（唯一有技术门槛的一步）

QQ 开放平台**没有**「列出机器人所在群」的接口，`group_openid` 只能从事件里拿。最省事的办法是本地起一个 `qq-botpy` 客户端监听群消息：

```python
import botpy

class C(botpy.Client):
    async def on_group_at_message_create(self, message):
        print("group_openid =", message.group_openid)   # 记下来
        await self.api.post_group_message(
            group_openid=message.group_openid, msg_type=0,
            content="已记录本群 openid ✅", msg_id=message.id)

# ⚠ 必须用最小意图：Intents.all() 含未申请的特权意图，会直接 4014 断开
botpy.Client(intents=botpy.Intents(public_messages=True)).run(
    appid="<AppID>", secret="<AppSecret>")
```

跑起来后，**去目标群里 @机器人 发一条消息**，控制台即打印 `group_openid`；填进 `wrangler.toml` 后 `wrangler deploy` 一次。
（`qq-botpy` 在部分国内镜像源缺失，需用官方 PyPI 或阿里云源安装。）

### 7. 建 Pages 项目并部署前端

```bash
wrangler pages project create <项目名> --production-branch=main
wrangler pages deploy web --project-name=<项目名> --branch=main --commit-dirty=true
```

### 8. 给 Pages 配 `WORKER_URL` 环境变量（漏了就 500）

Pages Functions 需要知道 Worker 地址，否则 `/api/*` 返回 `WORKER_URL environment variable is not set`。新版 `wrangler` 没有 `pages var put`，用 Cloudflare API 写：

```bash
TOK=$(wrangler auth token)
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/<项目名>" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"deployment_configs":{"production":{"env_vars":{"WORKER_URL":{"value":"https://<worker 域名>"}}},
                              "preview":{"env_vars":{"WORKER_URL":{"value":"https://<worker 域名>"}}}}}'
# 改完**重新部署一次前端**，变量才生效
```

至此：打开 `https://<项目名>.pages.dev`，粘 `FRONTEND_TOKEN` 登录 → 建提醒 → 次日 08:00 收群消息。

## 验收清单（缺一项就别算完成）

| # | 检查 | 期望 |
|---|---|---|
| 1 | `GET /api/reminders` 无 token | 401 |
| 2 | 带 `FRONTEND_TOKEN` 登录后建提醒 | 200，返回记录含 `next_fire` |
| 3 | 非法入参（空 title / 错日期格式） | 400 且给出具体原因 |
| 4 | `PUT` 只传部分字段 | 200，其余字段保留（不是被写空） |
| 5 | `wrangler dev --test-scheduled` 触发 cron | 群内实收「今日待办清单」 |
| 6 | 同日二次触发 cron | **不重复发**（`sent_log` 去重） |
| 7 | `POST /api/push` 无令牌 / 缺 text / 正常 | 401 / 400 / 200 且群内实收 |
| 8 | `GROUP_OPENID` 对应的群 | 与前端/任务同一个群 |

## 接 `study-abroad-planner` 定时监控任务

监控任务的 prompt 收尾加一步：把简报写成 JSON 文件，再用 `curl` 发给网关。**务必走 Pages 域名，不要用 workers.dev**；**务必用 `--data-binary @文件` 而不是 `-d '{...}'` 内联**（中文 + 换行 + 引号在 Git Bash 下会被转义破坏）。

```bash
# 1) 先用 Write 工具写 payload（换行写 \n，双引号写 \"）：
#    {"text":"简报正文","source":"study-abroad-school"}
# 2) 发送：
curl -sS --max-time 40 -X POST "https://<你的 Pages 域名>/api/push" \
  -H "Authorization: Bearer <PUSH_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  --data-binary @"<工作目录>/_build/push_school.json"
# 3) 成功断言：响应体含 "ok":true
#    失败（网络/401/400）必须如实报「QQ 群推送失败」+ HTTP 状态码 + 错误体，不许谎称已推送
```

## 已踩过的坑（照抄结论，别重走）

1. **`validateReminder()` 返回值契约搞反** → POST/PUT 恒 400，提醒根本建不进去。正确做法：成功返回 `{value}`、失败返回 `{error}`；`PUT` 走「先读旧行 → 合并 → 再写」，不要直接 bind 缺省字段（会写 `undefined`）。
2. **QQ 鉴权头不是 `Bearer`** → 报 `11241 Authorization 参数格式错误`。官方口径是 `Authorization: QQBot <access_token>`，且发送地址用统一域名 `https://api.sgroup.qq.com`（不是 `api.bot.qq.com`）。
3. **`sent_log` 用普通 INSERT** → 同日重复触发 cron 会撞唯一约束、被记成「发送失败」。必须 `INSERT OR IGNORE`。
4. **`functions/` 放错位置** → 报 `No Functions. Shimming...`，`/api/*` 全 404。它必须在**项目根**（与 `wrangler.toml` 同级），不能塞在 `web/` 里。
5. **漏配 Pages 的 `WORKER_URL`** → `/api/*` 500。按第 8 步用 API 写入 production + preview，再重新部署前端。
6. **国内网络打不通 `*.workers.dev`** → DNS 被污染到黑洞地址，直连与代理都失败。验证线上 Worker 一律**打 Pages 域名的 `/api/*`**，或用 Cloudflare API 查资源状态。

## 安全与忽略规则

`.gitignore` 已排除 `.dev.vars` / `.env*` / `wrangler.local.toml` / `group_openid.txt` / `node_modules/` / `.wrangler/`。
**三个 Secret、AppSecret、群 openid、D1/KV ID 属于私有信息**：`wrangler.toml` 里的非敏感变量可以入库，Secrets 只能走 `wrangler secret put` 或 Cloudflare Dashboard，永远不要提交到任何仓库。
