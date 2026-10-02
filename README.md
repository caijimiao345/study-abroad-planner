# study-abroad-planner（留学选校规划技能）

[![ci](https://github.com/caijimiao345/study-abroad-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/caijimiao345/study-abroad-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**在线演示**：[阿联酋×交通规划 · 静态快照](https://caijimiao345.github.io/study-abroad-planner/examples/uae-transportation/result-static.html)（GitHub Pages，免 JS 直接可看）

一个给 AI agent 用的**留学选校检索与呈现技能**：按用户档案（GPA / 本科背景 / 语言 / 预算 / 目标地区与专业）**穷尽检索**院校项目、逐条核验官网数据、估算课程匹配度与预算可行性，最后产出一个可筛选的自包含 HTML 对比页 + Notion 看板。

- 支持**全球任意国家/地区**（不设白名单，官方名录逐区穷尽）
- 支持**英语与所有小语种授课项目**（德/法/西/意/荷/日/韩…），可只筛英授
- 覆盖 14 个维度：申请要求、材料、录取标准、时间线、**课程匹配度（逐条解释）**、学签、毕业去向、薪资、工签、永居、入籍、学费生活费、兼职上限、奖学金
- 判定三件套：**录取四类**（保底/主申/冲刺/高风险）+ **先修风险**标记 + **预算四档**（可行/加兼职/兼职+奖学金/超预算）
- 一切数字带来源：官网链接 + 核验日期；未核验的如实标「待核验」

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
SKILL.md                       技能主文件（五步工作流）
references/
  finding-schools.md           ★ 检索手册：官方穷尽入口、20 项字段、核验纪律、坑清单、数量硬门槛、国家穷尽清单、小语种检索规则
  parallel-search.md           并行检索分片模板（多地区×多方向 → 多 agent 并跑）
  data-schema.md               数据字典（含录取四类/预算四档算法、小语种字段）
  course-matching.md           课程匹配度算法（核心60%+加分25%+成绩15%，含先修风险）
  visa-work-rights.md          学签/工签/永居/入籍/兼职的官方入口与结构模板
  notion-template.md           Notion 看板设计与定时监控打通
  automations.md               定时任务模板（院校截止日 / 签证政策监控）
assets/
  template.html                ★ 纯模板（默认无数据，靠 payload 注入）
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

## 设计要点（为什么这样写）

1. **穷尽优于抽样**：用官方课程名录（Discover Uni / CRICOS / Hochschulkompass / studyinnl / Universitaly / Mon Master / RUCT / QQI / CSPE / MQA…）逐区枚举，给出数量硬门槛（每"地区×专业"≥8 页、总候选 ≥60、完整数据 ≥30 条）
2. **准确优于完整**：每条带 `verified`/`verifiedDate`/`policyYear`；不确定就标待核验，**绝不编造数字**
3. **可追溯**：排除清单结构化留痕（为什么没有 XX 校，一查即得）；关键数字带「源」角标直达官网
4. **数据与呈现分离**：数据在 JSON、呈现靠模板注入，改模板不会让脚本失效
5. **可判定**：录取四类 + 先修风险 + 预算四档，全部给出算式与口径

## 许可

[MIT](LICENSE) —— 可自由复制 / 修改 / 商用，保留版权声明即可。引用院校数据请以官网为准。若你改进了检索规则或补充了新的国家/语言数据，欢迎提 PR。

## 参考案例与自检脚本

- `examples/uae-transportation/` —— **随机抽「阿联酋 × 交通规划」实跑的完整案例**：数据、排除清单、成品页、免 JS 静态快照、Notion CSV、复现命令。新任务可直接照它的目录结构复制。
- `scripts/render_check.js <成品.html>` —— 无浏览器渲染自检（DOM stub 真跑页面 JS，数出渲染卡片数）。
- `scripts/snapshot_static.js <成品.html> <快照.html>` —— 生成**免 JS 静态快照**：接收方环境不执行脚本时（部分预览器/邮件附件）用它交付，内容可见、交互不可用。
- 生成流程统一走 `scripts/build.js`（含前置数据自检 + **成品 JS 语法门禁**，不合格不产出文件）。
