# QQ 群提醒系统（可选增强 · 集成指南）

选校报告的终点不是一张 HTML，而是**别错过 DDL**。本文件说明如何把本技能的可选增强件 —— Cloudflare 版 QQ 群提醒系统 —— 部署起来并与定时监控任务打通。

- 可部署源码：`assets/qq-reminder/`（含 `README.md` 逐步部署说明 + `wrangler.toml` 占位模板）
- 部署栈：Cloudflare Workers（API + cron）+ Pages（前端 + `/api/*` 反代）+ D1（数据）+ KV（token 缓存），**免费额度内零成本**
- 与技能的关系：本技能负责「查准数据」，本系统负责「按时把结论推到你手机上的 QQ 群」

---

## 一、什么时候启用

启用信号（用户说过任一句就该主动提）：

- 「每天/每周提醒我别错过申请截止日」「怕忘了交材料」
- 「有什么变更及时告诉我」「能不能推到微信/QQ」
- 已经用本技能产出过选校报告与 Notion 看板，需要**持续跟踪**而不是一次性交付

**不启用**的情况：用户只是要一次性对比表、不打算长期跟踪，或不愿意注册 Cloudflare / 创建 QQ 机器人（这需要用户本人授权，无法代做）。

> 部署属于**外部动作**（会在用户 Cloudflare 账号下建资源、往真实 QQ 群发消息）：开始前先说明会创建哪些资源、会往哪个群发消息，得到同意再做。

---

## 二、需要用户提供的四样东西

| # | 项目 | 怎么拿 | 敏感级别 |
|---|---|---|---|
| 1 | QQ 机器人 `AppID` | QQ 开放平台 → 应用管理 → 机器人 | 低（非敏感，可进配置） |
| 2 | QQ 机器人 `AppSecret` | 同上 | **高**：只进 `wrangler secret`，绝不入库 |
| 3 | 目标 QQ 群 `group_openid` | **没有查询接口**，必须靠机器人收到群消息/入群事件时抓取（见模板 README 第 6 步） | **高**：视为私有标识 |
| 4 | Cloudflare 账号登录 | `wrangler whoami` 引导浏览器授权；或提供 API Token（Workers/Pages/D1 编辑权限） | **高** |

自己生成、不再外传的两个口令：`FRONTEND_TOKEN`（页面登录）、`PUSH_GATEWAY_TOKEN`（任务调网关）。建议用几组短词连字符拼成的长串（好念又够长）。

---

## 三、部署（8 步，命令见 `assets/qq-reminder/README.md`）

1. `wrangler d1 create` → 填 `database_id` → `d1 execute --remote --file=schema.sql` 建三表
2. `wrangler kv namespace create`（生产 + `--preview`）→ 填两个 id
3. `wrangler.toml` 填 `QQ_APP_ID` / `QQ_GROUP_OPENID` / `ALLOWED_ORIGIN`
4. `wrangler secret put` 注入 `QQ_APP_SECRET` / `FRONTEND_TOKEN` / `PUSH_GATEWAY_TOKEN`
5. `wrangler deploy` 部署 Worker
6. 本地 `qq-botpy` 抓 `group_openid`（**必须用 `Intents(public_messages=True)`**，`Intents.all()` 会 4014）
7. `wrangler pages project create` + `wrangler pages deploy web`
8. 用 Cloudflare API 给 Pages 写 `WORKER_URL` 环境变量 → **重新部署前端**

**顺序陷阱**：第 6 步的 `group_openid` 必须在第 5 步部署后、cron 生效前补齐，否则每天 08:00 的推送会因缺群标识而失败（失败会记进 `push_log`，不会静默）。

---

## 四、与定时监控任务的接法（核心）

每个监控任务的 prompt **收尾必须追加固定一步**，让简报进群。三个任务共用同一段：

```
【固定收尾：推送 QQ 群（必做，不得跳过或省略）】
把上面的简报整理成纯文本（不要 Markdown 表格，用「·」分条，≤800 字，保留关键日期与官方链接），然后：
a) 用 Write 工具写 payload 文件 {"text":"<简报正文>","source":"<来源标识>"}；
   注意 JSON 转义：正文换行写成 \n（两个字符），双引号写成 \"。
b) 用 Bash 执行：
   curl -sS --max-time 40 -X POST "https://<你的 Pages 域名>/api/push" \
     -H "Authorization: Bearer <PUSH_GATEWAY_TOKEN>" \
     -H "Content-Type: application/json" \
     --data-binary @"<工作目录>/_build/push_<来源标识>.json"
c) 必须断言响应体含 "ok":true。若失败（网络不通 / HTTP 401 / HTTP 400），
   在最终回复中如实写明「QQ 群推送失败」+ HTTP 状态码 + 错误体，
   绝不允许谎称已推送，也不允许跳过这一步。
```

**两个必须遵守的细节**（都是实测踩出来的）：

1. **走 Pages 域名，不要走 `*.workers.dev`** —— 国内网络对 `workers.dev` 常做 DNS 污染，直连与代理都失败；`*.pages.dev` 可达。这也正是「前端经 Pages 反代」这个架构的额外收益。
2. **用 `--data-binary @文件`，不要 `-d '{"text":"…"}'` 内联** —— 简报含中文、换行、书名号与引号时，内联 JSON 在 Git Bash 下极易被转义破坏。写文件再上传最稳。

任务与来源标识的对应（三个任务用不同文件名，避免互相覆盖）：

| 任务 | 计划 | `source` | payload 文件 |
|---|---|---|---|
| 院校窗口与截止日 | 每周一 09:00 | `study-abroad-school` | `_build/push_school.json` |
| APS/语言考试与申请窗口 | 每周二 09:30 | `study-abroad-aps` | `_build/push_aps.json` |
| 签证预约与政策 | 每月 5 日 10:00 | `study-abroad-visa` | `_build/push_visa.json` |

任务模板（`prompt` 与 `rrule`）见 `automations.md`。

---

## 五、验收清单（缺一项不算完成）

| # | 检查 | 期望 |
|---|---|---|
| 1 | `/api/reminders` 无 token | 401 |
| 2 | 带前端口令建提醒 | 200，返回含 `next_fire` |
| 3 | 非法入参（空 title、错日期格式） | 400 + 具体原因 |
| 4 | `PUT` 只传部分字段 | 200，其余字段**保留**（不是被写空） |
| 5 | `wrangler dev --test-scheduled` 触发 cron | 群内**实收**「今日待办清单」 |
| 6 | 同日二次触发 cron | **不重复发** |
| 7 | 网关推送 401 / 400 / 200 三分支 | 均正确，200 时群内实收 |
| 8 | 用「与定时任务完全相同的命令」做一次自测 | HTTP 200 + `push-log` 记 `status=sent` |
| 9 | 生产测试数据 | 验证后清理（别把冒烟测试条目留在提醒列表里） |

---

## 六、故障速查

| 症状 | 根因 | 处置 |
|---|---|---|
| 建提醒恒 400 | 校验函数返回值契约被写反（成功返回了对象、调用方 `if (err)` 恒真） | 成功返回 `{value}`、失败返回 `{error}`；`PUT` 先读旧行再合并 |
| QQ 报 `11241 Authorization 参数格式错误` | 鉴权头用了 `Bearer` | 必须是 `Authorization: QQBot <access_token>`，域名 `https://api.sgroup.qq.com` |
| 同日收到重复提醒 | `sent_log` 用了普通 INSERT，撞唯一约束被误记失败 | 改 `INSERT OR IGNORE` |
| Pages 报 `No Functions. Shimming...`，`/api/*` 404 | `functions/` 放在了静态目录里 | 移到**项目根**（与 `wrangler.toml` 同级） |
| `/api/*` 返回 `WORKER_URL environment variable is not set` | Pages 缺环境变量 | 用 Cloudflare API 写 production + preview，再重新部署前端 |
| 群列表接口 404 | QQ 官方**没有**该接口 | 改用事件抓取（`public_messages=True`） |
| 本地连不上 `workers.dev` | DNS 污染 | 一律改打 Pages 域名的 `/api/*` |
| `wrangler pages deploy` 偶发 `fetch failed` | 代理瞬时抖动（同一请求前一次 200） | 直接重试，不是配置问题 |

---

## 七、隐私与开源边界（重要）

**可以进仓库**：源码、`schema.sql`、`wrangler.toml` 里的 `<REPLACE_*>` 占位符、部署文档。

**绝不能进仓库**：`AppSecret`、`FRONTEND_TOKEN`、`PUSH_GATEWAY_TOKEN`、`group_openid`、D1/KV 的 UUID、Cloudflare 账号 ID 与邮箱、任何 `*.workers.dev` 实际域名、本地绝对路径。

落地要求：

- `assets/qq-reminder/.gitignore` 已排除 `.dev.vars` / `.env*` / `wrangler.local.toml` / `group_openid.txt` / `.wrangler/`
- 真实值只存在于三处：Cloudflare Secret（加密）、本机被忽略的本地配置、以及运行任务的 prompt 内
- 发布前用打包脚本的脱敏扫描兜底（已把上述真实凭据值加入黑名单，命中即中止打包）
