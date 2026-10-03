# 定时监控任务模板（三任务 + QQ 群推送）

把「查数据」变成「持续跟踪」。三个任务分工不同、互不重叠，**每周/每月自动跑**，发现变更就更新看板，并把简报推进 QQ 群（可选增强，见 `qq-reminder.md`）。

| 任务 | 频率 | 关注什么 | QQ 来源标识 |
|---|---|---|---|
| **A. 院校窗口与截止日** | 每周一 09:00 | 未来 30 天内有节点的项目：开放 / 截止 / 出结果 / 押金 | `study-abroad-school` |
| **B. APS/语言考试与申请窗口** | 每周二 09:30 | APS 审核节奏、语言考试考位、各国前置认证窗口 | `study-abroad-aps` |
| **C. 签证预约与政策** | 每月 5 日 10:00 | 学签/工签/永居/入籍/兼职政策变化 + 预约等待时间 | `study-abroad-visa` |

> 创建方式：用 `automation_update`（mode=create）把对应 `prompt` 与 `rrule` 填入，`cwds` 填项目工作目录。
> **三个任务不会自己出现在自动化列表里** —— 只有把 prompt 与 rrule 真正交给 `automation_update` 才算创建成功，写进本文件不等于已生效。
> 若自动化服务暂不可用，先把 prompt 存档，恢复后创建；或手动按频率执行。

---

## 固定收尾：推送 QQ 群（三个任务共用）

**每个任务 prompt 末尾都必须追加这一段。** 未部署 QQ 提醒系统时删除该段即可，其余部分照跑。

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

**两条硬要求**（实测得出，别改）：

1. **走 Pages 域名，不要用 `*.workers.dev`** —— 国内对该域常有 DNS 污染，直连与代理都不可达；`*.pages.dev` 可达。
2. **用 `--data-binary @文件`，不要 `-d '{"text":"…"}'` 内联** —— 中文 + 换行 + 引号在 Git Bash 下会被转义破坏。三个任务用**不同文件名**（`push_school` / `push_aps` / `push_visa`），避免互相覆盖。

---

## A. 院校窗口与截止日（每周一 09:00）

- `scheduleType`: recurring
- `rrule`: `FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0`
- `cwds`: 项目工作目录
- `prompt`:

```
【留学申请监控·院校申请窗口与截止日】
数据源：<工作目录>/notion_模板/1_申请项目总表.csv（每校一行，含 QS、专业官网、招生入口、申请时间线、数据核验日期）。

严格遵守「零记忆交付」：所有信息必须实时联网查官方页面，不得凭记忆填写。

步骤：
1) 读取该 CSV，筛出未来 30 天内有节点的项目（申请开放 / 截止 / 出结果 / 押金）。
2) 对每个命中项目用 WebFetch 打开其「专业官网」核验：日期是否变动、是否新增轮次、项目是否更名或停招。
   只信院校官网，禁用中介站与聚合站。
3) 同时扫一次该地区官方课程名录（英国 Discover Uni、澳洲 CRICOS、德国 Hochschulkompass、
   荷兰 studyinnl/DUO、爱尔兰 QQI、中国香港 CSPE、马来西亚 MQA 等），
   看是否出现清单外符合条件的新项目，有则标「新增候选」。
4) 有变更：更新 CSV 对应行的申请时间线与核验日期，并把变更追加到 <工作目录>/变更日志.md
   （格式：日期｜学校｜项目｜字段｜原值→新值｜来源链接）。
5) Notion 同步：若存在 mcp__notion__* 工具，把变更更新到 Notion「申请项目总表」数据库对应页面；
   若工具不可用，只改本地文件并在回复中提示「需先在 WorkBuddy 连接器启用 Notion 工具」，不得假称已写入。
6) 输出简报：本周待办 3–5 件 + 截止倒计时 + 变更清单。无变更时如实说明，不要编造日期。

【固定收尾：推送 QQ 群（必做，不得跳过或省略）】
把上面的简报整理成纯文本（不要 Markdown 表格，用「·」分条，≤800 字，保留关键日期与官方链接），然后：
a) 用 Write 工具写 payload 文件 {"text":"<简报正文>","source":"study-abroad-school"}；
   注意 JSON 转义：正文换行写成 \n（两个字符），双引号写成 \"。
b) 用 Bash 执行：
   curl -sS --max-time 40 -X POST "https://<你的 Pages 域名>/api/push" \
     -H "Authorization: Bearer <PUSH_GATEWAY_TOKEN>" \
     -H "Content-Type: application/json" \
     --data-binary @"<工作目录>/_build/push_school.json"
c) 必须断言响应体含 "ok":true。若失败（网络不通 / HTTP 401 / HTTP 400），
   在最终回复中如实写明「QQ 群推送失败」+ HTTP 状态码 + 错误体，
   绝不允许谎称已推送，也不允许跳过这一步。
```

---

## B. APS/语言考试与申请窗口（每周二 09:30）

- `scheduleType`: recurring
- `rrule`: `FREQ=WEEKLY;BYDAY=TU;BYHOUR=9;BYMINUTE=30`
- `cwds`: 项目工作目录
- `prompt`:

```
【留学申请监控·APS/语言考试与申请窗口】
数据源：<工作目录>/notion_模板/1_申请项目总表.csv 与 3_申请签证时间线.csv；
技能参考：study-abroad-planner 的 references/germany-process.md 与 country-process.md。

严格遵守「零记忆交付」：所有信息必须实时联网查官方页面，不得凭记忆填写。

检查项：
1) APS 审核（德国方向）：打开 https://www.aps.org.cn 公告与常见问题，核验审核周期、费用、
   面谈安排、免审政策是否变化；若目标清单里有德国项目，提示 APS 启动时点（硬前置，周期 2–3 个月）。
2) 语言考试考位与日期：TestDaF（中国考点与考试日期）、DSH（目标德国高校的校外考试）、
   IELTS/TOEFL 考位与出分时间；提醒「差 0.5 分也要尽早重考」。
3) 各国前置认证（按清单国家）：法国 Campus France 开放/截止、意大利 Universitaly 预注册窗口、
   西班牙学历认证周期、加拿大 PAL 名额政策、美国 I-20/SEVIS 与面签预约等待时间、澳洲 CoE 与 GS 要求。
4) 申请窗口：读表1/表3，找出未来 60 天内到期的申请节点（含非 EEA 早截止），给出倒计时。
5) 更新与输出：有变更则更新对应 CSV 行并把变更追加到 <工作目录>/变更日志.md
   （格式：日期｜项目｜字段｜原值→新值｜官方来源链接）；输出简报。无变更时如实说明，不要编造日期。
6) Notion 同步：若存在 mcp__notion__* 工具，把变更同步到 Notion 对应数据库；
   工具不可用则只改本地并在回复中提示「需先在连接器启用 Notion 工具」，不得假称已写入。

【固定收尾：推送 QQ 群（必做，不得跳过或省略）】
把上面的简报整理成纯文本（不要 Markdown 表格，用「·」分条，≤800 字，保留关键日期与官方链接），然后：
a) 用 Write 工具写 payload 文件 {"text":"<简报正文>","source":"study-abroad-aps"}；
   注意 JSON 转义：正文换行写成 \n（两个字符），双引号写成 \"。
b) 用 Bash 执行：
   curl -sS --max-time 40 -X POST "https://<你的 Pages 域名>/api/push" \
     -H "Authorization: Bearer <PUSH_GATEWAY_TOKEN>" \
     -H "Content-Type: application/json" \
     --data-binary @"<工作目录>/_build/push_aps.json"
c) 必须断言响应体含 "ok":true。若失败（网络不通 / HTTP 401 / HTTP 400），
   在最终回复中如实写明「QQ 群推送失败」+ HTTP 状态码 + 错误体，
   绝不允许谎称已推送，也不允许跳过这一步。
```

---

## C. 签证预约与政策（每月 5 日 10:00）

- `scheduleType`: recurring
- `rrule`: `FREQ=MONTHLY;BYMONTHDAY=5;BYHOUR=10;BYMINUTE=0`
- `cwds`: 项目工作目录
- `prompt`:

```
【留学申请监控·签证预约与材料节点】
数据源：<工作目录>/notion_模板/（2_申请与签证材料清单.csv、3_申请签证时间线.csv、4_地区签证政策库.csv）。

步骤：
1) 读取表2/表3，找出未来 60 天内的待办：体检、资金证明、APS 审核、递签预约、
   CAS/IPA/CoE/eVAL、住宿申请等，给出截止倒计时。
2) 读取表4，逐国家/地区用其官方链接（gov.uk、中国香港入境处、新加坡 ICA/MOM、澳洲 Home Affairs、
   荷兰 IND、德国 Auswärtiges Amt、爱尔兰 IRIS、瑞士 SEM、马来西亚 EMGS、APS 官方等）
   核验学签/工签/永居/入籍/兼职上限是否变化；同时核验使领馆或签证中心的预约渠道与当前等待时间。
3) 有变更：更新表2状态、表3计划日期、表4政策与核验日期，并把变更追加到 <工作目录>/变更日志.md
   （日期｜地区｜政策项｜原值→新值｜官方来源链接）。
4) Notion 同步：若存在 mcp__notion__* 工具，更新 Notion「地区签证政策库」与「申请签证时间线」数据库；
   若工具不可用，只改本地文件并在回复中提示「需先在 WorkBuddy 连接器启用 Notion 工具」，不得假称已写入。
5) 输出简报：需办理/预约清单（附官方入口链接）+ 政策变更提醒。只信移民局与使领馆官网；
   无官方来源的标「未确认」，不许编造。

【固定收尾：推送 QQ 群（必做，不得跳过或省略）】
把上面的简报整理成纯文本（不要 Markdown 表格，用「·」分条，≤800 字，保留关键日期与官方链接），然后：
a) 用 Write 工具写 payload 文件 {"text":"<简报正文>","source":"study-abroad-visa"}；
   注意 JSON 转义：正文换行写成 \n（两个字符），双引号写成 \"。
b) 用 Bash 执行：
   curl -sS --max-time 40 -X POST "https://<你的 Pages 域名>/api/push" \
     -H "Authorization: Bearer <PUSH_GATEWAY_TOKEN>" \
     -H "Content-Type: application/json" \
     --data-binary @"<工作目录>/_build/push_visa.json"
c) 必须断言响应体含 "ok":true。若失败（网络不通 / HTTP 401 / HTTP 400），
   在最终回复中如实写明「QQ 群推送失败」+ HTTP 状态码 + 错误体，
   绝不允许谎称已推送，也不允许跳过这一步。
```

---

## D. 手动兜底（自动化不可用时）

- 每两周手动执行一次任务 A 的 prompt
- 收到 offer 后：优先推进 表2 材料清单 + 表3 的签证节点，材料与签证顺序不要乱
- 任何政策数字在用于决策前，都要点开官方链接确认一次

## E. 干跑自检（创建任务后建议做一次）

1. `automation_update`（mode=list）确认三个任务**真的在列表里**且 `status=ACTIVE`
2. 核对 `rrule` 与实际语义一致：周一 09:00 / 周二 09:30 / 每月 5 日 10:00
3. 用「与任务完全相同的 curl 命令」手动推一条自测消息，确认 HTTP 200、群内实收、`push-log` 有记录
4. 观察一个周期后回看 `push_log`：**连续失败**通常意味着 `group_openid` 或 token 已失效
