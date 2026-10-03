# study-abroad-planner（留学选校规划技能）

[![ci](https://github.com/caijimiao345/study-abroad-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/caijimiao345/study-abroad-planner/actions/workflows/ci.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE)

**简体中文** | [English](README.en.md)

**在线演示**：[交互版](https://caijimiao345.github.io/study-abroad-planner/examples/uae-transportation/demo.html)（筛选/排序可交互）｜[静态快照版](https://caijimiao345.github.io/study-abroad-planner/examples/uae-transportation/result-static.html)（免 JS 环境用）。演示数据为生成日口径（2026-10-02），正式使用前必须回官网复核

一个给 AI agent 用的**留学选校检索与呈现技能**：按用户档案（GPA / 本科背景 / 语言 / 预算 / 目标地区与专业）**穷尽检索**院校项目、逐条核验官网数据、估算课程匹配度与预算可行性，最后产出一个可筛选的自包含 HTML 对比页 + Notion 看板。

- 支持**全球任意国家/地区**（不设白名单，官方名录逐区穷尽）
- **多国任务搜索计划**：先出搜索计划（硬约束过筛 → 保留国清单 → 贴给用户看，**不等确认**）再逐国穷举，交付含「国家覆盖表」——数量门槛按每国计，不许摊薄、不许只深查一两国
- 支持**英语与所有小语种授课项目**（德/法/西/意/荷/日/韩…），可只筛英授
- 覆盖 24 项必查字段 / 14 个维度：申请要求、材料、录取标准、时间线、**课程匹配度（逐条解释 + 本科对标校准）**、**学分换算（中国学分 ↔ ECTS 总量门槛）**、学签（中国学生口径）、毕业去向与薪资、工签、永居、入籍、学费生活费、兼职上限、奖学金、**工作经验要求**、**招生办官方联系方式**
- 判定三件套：**录取四类**（保底/主申/冲刺/高风险）+ **先修风险**标记 + **预算四档**（可行/加兼职/兼职+奖学金/超预算）——页面显著声明均为 AI 机械估算，具体申请资格以招生办官方答复为准
- 一切数字带来源：官网链接 + 核验日期；未核验的如实标「待核验」
- **可选增强 · QQ 群提醒（自带可部署源码）**：把选校结论推到手机上，而不是停在浏览器标签里 —— 部署到 Cloudflare（Workers + Pages + D1 + KV，全部在免费额度内，零服务器成本），前端填提醒（类型 / 目标日期 / 提前 N 天 / 每天·每周·每月），每天北京时间 08:00 推「今日待办清单」到 QQ 群；配合三个定时监控任务，院校截止日与签证政策变更也会自动进群。见 `references/qq-reminder.md` 与 `assets/qq-reminder/`

## 安装

```bash
# WorkBuddy：复制到用户技能目录
cp -r study-abroad-planner ~/.workbuddy/skills/
# CodeBuddy：改放到 ~/.codebuddy/skills/
```
装好后，对话里说「按我的绩点/专业/预算查一下 XX 国 XX 专业的学校」即可触发。

## 快速开始（生成一份自己的选校对比页）

```bash
# 1) 写数据（唯一数据源）；示例见 assets/data.json
#    assets/data.json        meta + profile + data[] + schoolLinks + regionLinks
#    assets/exclusions.json  结构化排除清单（school/program/reason/source/checkedDate）
# 2) 构建（含前置自检：数据为空/字段缺失/无核验日期/链接缺口 → 直接失败）
node scripts/build.js 我的选校对比.html assets/data.json
# 3) 审计与判定校验
node scripts/audit_dataset.js assets/data.json
node scripts/verify_rules.js assets/data.json
# 4) 生成 Notion 四表 CSV（项目总表 / 材料清单 / 时间线 / 政策库）
node scripts/generate_notion_csv.js assets/data.json notion_模板
```

## 目录结构

```
SKILL.md                       技能主文件（五步工作流 + 第 6 步可选增强：QQ 群提醒）
CHANGELOG.md                   更新日志（v1.2.4：示例档案本科专业留空 + 编辑器预览注入清理；v1.2.3：隐私清理，示例数据不再复用真实档案口径 + cron 空表说明；v1.2.2：QQ 提醒支持出群消息统一前缀；v1.2.1：移除搜索计划的「等用户确认」闸门；v1.2.0：QQ 群提醒系统并入技能；v1.1.0：多国搜索计划 / 24 项字段 / 反偷懒门禁 / 本科对标 / 学分换算）
references/
  finding-schools.md           ★ 检索手册：官方穷尽入口、24 项字段、核验纪律、坑清单、数量硬门槛、国家穷尽清单、小语种检索规则
  parallel-search.md           并行检索分片模板（多地区×多方向 → 多 agent 并跑）
  data-schema.md               数据字典（含录取四类/预算四档算法、小语种字段）
  course-matching.md           课程匹配度算法（核心60%+加分25%+成绩15%，含先修风险）
  visa-work-rights.md          学签/工签/永居/入籍/兼职的官方入口与结构模板
  notion-template.md           Notion 看板设计与定时监控打通
  automations.md               定时任务模板（三任务：院校截止日 / APS 与语言考试 / 签证政策）+ 推送 QQ 群固定收尾
  qq-reminder.md               可选增强：QQ 群提醒系统集成指南（部署八步 / 接网关 / 九条验收 / 隐私边界）
assets/
  template.html                ★ 纯模板（默认无数据，靠 payload 注入）
  qq-reminder/                 可部署的 QQ 提醒系统模板（Worker 源码 + Pages 反代 + D1 schema + 前端 + CI；wrangler.toml 为占位符）
  data.json                    示例数据集（72 条 × 32 地区 × 22 专业方向，含小语种项目示例）
scripts/
  build.js                     ★ 唯一构建入口（注入 + 前置自检）
  audit_dataset.js             数据审计
  verify_rules.js              判定口径离线校验
  generate_notion_csv.js       Notion 四表生成
  snapshot_static.js           静态快照生成（最终交付物；交互版 HTML 只是中间产物）
  render_check.js              无浏览器渲染验证
examples/
  uae-transportation/          参考案例（阿联酋×交通规划：数据 + 排除清单 + 静态快照 + Notion CSV）
```

## 数据与隐私

- 仓库内的数据是**示例数据**（示例档案），不含任何真实个人信息
- `assets/data.json` 里的 `profile` 为示例值，使用时替换为你自己的档案
- 生成你自己的对比页时，产物 HTML 会包含你填写的档案 → **不要公开分享含个人档案的 HTML**

## 可选增强：QQ 群提醒（Cloudflare，含可部署源码）

选校报告的终点不该是一张 HTML，而是**别错过 DDL**。本技能自带一套可直接部署的提醒系统（`assets/qq-reminder/`）：

```
三个定时监控任务 ──简报──▶ POST /api/push（Bearer 令牌）
                                    │
CF Pages 前端（填提醒）──▶ /api/reminders ─▶ Worker ─▶ D1
                                    │
CF Workers Cron（每日 UTC 00:00）──▶ 今日待办清单 ──▶ QQ 群
```

- **成本**：Workers + Pages + D1 + KV 全在 Cloudflare 免费额度内；无需服务器、公网 IP、备案
- **每天 08:00**：扫出处在「提前 N 天」窗口期的申请节点，合并成一条「今日待办清单」推群，同日只发一次
- **有变更就报**：院校截止日（每周一）、APS 与语言考位（每周二）、签证政策（每月 5 日）三类简报自动转发进同一个群
- **架构细节**：前端不直连 Worker，而是经 Pages Functions 反代 `/api/*` —— 国内 `*.workers.dev` 常被 DNS 污染不可达，`*.pages.dev` 可达，反代顺带解决了可达性
- **部署**：`references/qq-reminder.md`（八步 + 九条验收清单 + 8 类故障速查）；模板源码在 `assets/qq-reminder/`
- **安全**：模板里只有 `<REPLACE_*>` 占位符。`AppSecret`、页面口令、网关令牌、群 `openid`、D1/KV 资源 ID 一律走 Cloudflare Secret 或本机被 gitignore 的配置，**绝不入仓库**

## 设计要点（为什么这样写）

1. **穷尽优于抽样**：用官方课程名录（Discover Uni / CRICOS / Hochschulkompass / studyinnl / Universitaly / Mon Master / RUCT / QQI / CSPE / MQA…）逐区枚举，给出数量硬门槛（每"地区×专业"≥8 页、总候选 ≥60、完整数据 ≥30 条）；多国任务先出搜索计划再逐国穷举，门槛按每国计（finding-schools.md 8.0）
2. **准确优于完整**：每条带 `verified`/`verifiedDate`/`policyYear`；不确定就标待核验，**绝不编造数字**
3. **可追溯**：排除清单结构化留痕（为什么没有 XX 校，一查即得）；关键数字带「源」角标直达官网
4. **数据与呈现分离**：数据在 JSON、呈现靠模板注入，改模板不会让脚本失效
5. **可判定**：录取四类 + 先修风险 + 预算四档，全部给出算式与口径

## 许可

[CC BY-NC-SA 4.0](LICENSE) —— 可自由复制 / 修改 / 再分发，但**禁止商业使用**，且衍生作品须以相同条款共享并署名。引用院校数据请以官网为准。若你改进了检索规则或补充了新的国家/语言数据，欢迎提 PR。

## 参考案例与自检脚本

- `examples/uae-transportation/` —— **随机抽「阿联酋 × 交通规划」实跑的完整案例**：数据、排除清单、成品页、免 JS 静态快照、Notion CSV、复现命令。新任务可直接照它的目录结构复制。
- `scripts/render_check.js <成品.html>` —— 无浏览器渲染自检（DOM stub 真跑页面 JS，数出渲染卡片数）。
- `scripts/snapshot_static.js <成品.html> <快照.html>` —— 生成**免 JS 静态快照**：接收方环境不执行脚本时（部分预览器/邮件附件）用它交付，内容可见、交互不可用。
- 生成流程统一走 `scripts/build.js`（含前置数据自检 + **成品 JS 语法门禁**，不合格不产出文件）。
