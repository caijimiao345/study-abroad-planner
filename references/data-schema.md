# 数据字典（每所学校一条 JSON）

模板 `assets/template.html` 中 `DATA` 数组的元素结构。字段名必须一致，模板靠字段名渲染。

## 顶层元数据

```json
{
  "generatedDate": "2026-10-02",
  "verifiedDateRange": "2026-09-28 ~ 2026-10-02",
  "fxRateNote": "1 GBP≈9.2 CNY, 1 HKD≈0.92 CNY, 1 SGD≈5.4 CNY, 1 AUD≈4.7 CNY, 1 EUR≈7.8 CNY（2026-10-02 中间价，生成时更新）",
  "disclaimer": "以院校官网与移民局当期政策为准"
}
```

## 每所学校记录

```json
{
  "id": "ucl-gs",
  "school": "伦敦大学学院",
  "schoolEn": "University College London",
  "region": "英国",                      // 开放枚举：英国|香港|新加坡|澳洲|美国|加拿大|德国|法国|意大利|西班牙|荷兰|比利时|奥地利|瑞士|爱尔兰|北欧|马来西亚|日韩|其他（不设白名单，筛选器按数据动态生成 chips）
  "program": "MSc Geospatial Sciences",
  "programCn": "地理空间科学硕士",
  "curriculum": ["GIS 原理与应用（Foundations of GIS）", "空间数据库", "空间分析与统计", "Python 地理计算", "遥感与地物观测", "毕业研究项目"],
  "department": "土木·环境与地理工程系",
  "duration": "1 年",
  "intake": ["9月"],
  "qsRank": 9,                           // 当年 QS 综合
  "subjectRank": "GIS 方向 QS 地理学科全球第 1 档",
  "tuition": {"amount": 35000, "currency": "GBP", "cny": 322000, "per": "年"},
  "livingCost": {"amount": 15000, "currency": "GBP", "cny": 138000, "per": "年",
                 "note": "伦敦非伦敦差异大，英国学生签资金证明按官方口径单独算"},
  "entryReq": {
    "degree": "相关学科学士二等一及以上（中国：均分 85+，211/985 可 80+）",
    "gpaTier": {"tier1": "80", "tier2": "85", "note": "tier1=985/211"},
    "language": {"ielts": {"overall": 6.5, "min": 6.0},
                 "toefl": {"overall": 92},
                 "langClass": false},
    "gre": "不要求",
    "workExp": {"required": false, "years": "", "note": "申请页未列工作经验要求，应届可申；以招生办答复为准", "checkedDate": "2026-10-03"},
    "creditReq": {"ectsRequired": 240, "note": "高级硕士要求至少 240 ECTS 学位背景", "source": "官方URL", "verifiedAt": "2026-10-03"},
    "prereq": "量化背景（数学/统计/编程课程）",
    "prereqHard": false,                    // true=硬性先修，未覆盖时页面叠加"先修风险"警示
    "others": "相关实习/科研加分"
  },
  "materials": ["PS", "CV", "推荐信 ×2", "成绩单+均分证明", "在读证明/学位证", "语言成绩（可后补）"],
  "admissionLogic": "rolling+分轮审核；先到先得，GPA 过线后看 PS 与背景相关性；语言为门槛线不参与排序",
  "timeline": [
    {"date": "10 月上旬", "event": "开放申请"},
    {"date": "11 月-次年 3 月", "event": "分轮出结果（每轮约 4-6 周）"},
    {"date": "次年 4-6 月", "event": "换无条件+交押金（如有）"},
    {"date": "入学当年 6-8 月", "event": "办 CAS → 递签"}
  ],
  "match": {
    "score": 82,                          // 0-100
    "tier": "高",                          // 高|中|低
    "explanations": [
      {"type": "核心", "text": "《GIS原理》→ 覆盖 'Foundations of GIS' 模块"},
      {"type": "缺口", "text": "缺高级统计，建议补修或 PS 说明"},
      {"type": "本科对标", "text": "本科对标：该校同专业本科核心课 18 门，覆盖 13 门（72%）—— 缺《流体力学》《土力学》"},
      {"type": "学分门槛", "text": "要求 240 ECTS；168 中国学分 ≈ 100 ECTS（AI 换算估算）→ 估算不足，属资格性缺口"}
    ]
  },
  "bachelorBenchmark": {                  // 本科对标（course-matching.md 第 4 步）：找不到官方页就只留 note 待核验
    "program": "BSc Civil Engineering（对标本科）",
    "url": "官方课程结构页 URL",
    "coreCourses": ["流体力学", "土力学", "工程经济学"],
    "coverage": "13/18（72%）",
    "fetchedAt": "2026-10-03"
  },
  "visa": {
    "type": "Student visa（原 Tier 4）",
    "process": "CAS → 在线申请+生物信息 → 领馆/签证中心 → 护照贴签或 eVisa",
    "materials": ["CAS", "资金证明（学费+9 个月生活费，伦敦 £1,483/月口径）", "肺结核检测", "ATAS（部分专业）", "语言（CAS 上已含）"],
    "duration": "课程时长 + Graduate Route 缓冲",
    "cost": {"amount": 524, "currency": "GBP", "note": "境外申请费，含 IHS 另计"},
    "processingTime": "约 3 周（加急可选）"
  },
  "career": {
    "directions": ["GIS 开发/空间数据工程", "遥感分析", "城市规划咨询"],
    "employers": ["Ordnance Survey", "Esri UK", "咨询与政府部门"],
    "note": "官网未披露就业率的不写数字"
  },
  "salary": {"amount": "£28k-£38k", "cny": "26万-35万", "note": "英国 GIS 应届，Glassdoor/官方 LFS 口径"},
  "workVisa": {
    "name": "Graduate Route",
    "duration": "2 年（博士 3 年）",
    "condition": "完成学业即可申请，不需 offer；到期转 Skilled Worker 需雇主担保且 2027 后政策存在变数，核验当年政策"
  },
  "pr": {"years": "Skilled Worker 满 5 年", "conditions": ["连续合法居留", "语言 B1", "Life in UK 测试"]},
  "citizenship": {"years": "永居后 1 年（合计通常 6 年）", "conditions": ["入籍考试", "良好品行", "无长期离境"]},
  "partTime": {"hours": "学期内每周 ≤20 小时，假期全职",
               "hourlyWage": "£12.21（2025 全国最低生活工资）",
               "incomeYearCnyMax": 90000,
               "note": "上限=法定周时长×当地典型时薪×约40 有效周，保守估算；课程密集项目实际无余力，如实提示"},
  "scholarships": [
    {"name": "校奖学金（院系自动评估）", "amount": "10%-50% 学费减免", "amountCnyMax": 160000, "countable": true, "effort": "高 GPA + 早申"},
    {"name": "CSC 公派（读博为主）", "amount": "全奖", "amountCnyMax": 500000, "countable": false, "effort": "需拿到无条件 offer 后申报"}
  ],
  "verified": true,
  "verifiedDate": "2026-10-02",
  "links": {                                // ✅ 必须给官网链接，不给聚合站/中介站
    "program": "https://官网项目页",
    "admissions": "https://官网招生页（可与 program 相同）",
    "note": "链接失效或不确定时置 null 并在此说明，不要编造深链"
  },
  "sources": ["数据来源说明（哪个官网的哪一页）", "政策来源（移民局官网）"]
}
```

## 官方链接要求（links）

每所学校必须给可点击的官方链接，模板会渲染在卡片头部与详情页末尾：

| 链接 | 内容 | 规则 |
|---|---|---|
| `links.program` | 该项目官网页面（课程设置/申请要求页） | 优先精确到项目页；只有学院/系首页时可用学院页 |
| `links.admissions` | 招生/申请入口（网申系统、how to apply 页） | 与 program 相同则重复给 |
| `links.visa` | 当地区学生签证官方页（gov.uk / 入境处 / ICA / Home Affairs / IND / 外交部等） | 按地区统一，从 `REGION_LINKS` 表取 |
| `links.residency` | 永居/入籍官方页 | 同上 |
| `sources` | 文字说明每个数字的出处 | 无 |

- **禁止**给中介站、留学论坛、聚合站、"某留学网"类链接
- 不确定深链是否有效时，退到**稳定的学院/项目列表页**，不要拼一个可能 404 的深层路径
- 地区政策链接统一维护在模板 `REGION_LINKS` 常量里，新增地区照此格式追加

## 字段速查

| 字段 | 必填 | 说明 |
|---|---|---|
| id / **field** / school / schoolEn / region / program | ✅ | **field = 专业方向**（开放枚举，如「地理信息·测绘遥感」「城市与规划」「交通·出行规划」「环境·可持续·气候」）；前端的「目标专业方向」多选筛选器直接依赖此字段；一条记录只填一个主方向 |
| region | ✅ | 开放枚举（全球任意地区；筛选器 chips 从数据动态生成，不设白名单） |
| programCn / curriculum | ✅ | 专业中文名 + 研究生课程清单（中文写核心模块，必要时附英文原名） |
| duration / **intake** / qsRank / subjectRank | ✅ | **intake = 入学时间数组**，写成可枚举月份（`["9月"]`、`["2月","7月"]`、`["4月","10月"]`）；前端的「入学季」筛选器直接依赖它。学制 duration 单独记（总花费 = 年花费 × 学制年数）。qsRank 用当年 QS 综合排名，不参与 QS 综合排名的专门学院填 0 并在 subjectRank 说明 |
| tuition / livingCost | ✅ | 本币 amount+currency+cny 换算 |
| entryReq | ✅ | gpaTier 分层、language 含小分、langClass 是否可配语言班 |
| entryReq.**teachingLanguage** | ✅ | **授课语言**（"英语" / "德语" / "法语" / "西班牙语" / "日语" / "英语（部分模块德语）" 等）。前端「授课语言」筛选器依赖此字段；英授与小语种项目**同库共存** |
| **graduationLang** | ✅ | **毕业语言要求**：`{req, detail, note}`。必须与「签证语言要求」「永居/入籍语言要求」分开写——三者是不同节点（英授项目多无本地语毕业要求，但永居普遍要考本地语） |
| entryReq.**localLang** | 小语种必填 | 本地语言要求：`{type, detail, langSchool, note}`。英授项目写 "英语证明"；小语种项目写具体门槛（DSH-2/TestDaF 4×4、DELF B2、DELE B2、JLPT N2、TOPIK 4…）与是否有语言班/预科路径 |
| materials / admissionLogic / timeline | ✅ | admissionLogic 写清"按什么排"（分轮/rolling/权重） |
| match | ✅ | score+tier+explanations（逐条解释，见 course-matching.md） |
| visa | ✅ | type/process/materials/cost/processingTime |
| career / salary | ✅ | 无来源不编数字 |
| workVisa / pr / citizenship / visa | ✅ | 政策必须核验年份：**每个政策对象都要带 `policyYear`**（如 "2026"），月度监控任务据此比对政策是否变更 |
| partTime / scholarships | ✅ | scholarships 至少 1 条，标获取难度 |
| verified / verifiedDate / sources | ✅ | verified=false 时页面打灰标 |
| links | ✅ | program/admissions 官方链接；不给中介站与聚合站，不确定时退到学院列表页 |

## 判定与筛选规则（模板 JS 已实现，生成方与模板口径必须一致）

### A. 录取可行性判定（四类互斥 + 先修风险叠加，实时重算）

输入：profile.gpa.value + schoolTier、profile.language、entryReq.gpaTier/language/prereqHard、match.tier。

```
gpaLine = (tier1) ? gpaTier.tier1 : gpaTier.tier2
gpaGap  = gpaLine − gpa.value（负数 = 用户分数超出该线，越负越稳）
langGap = max(要求总分 − 用户总分, 要求小分 − 用户小分, 0)

互斥类（每校恰好归入一类）：
- 保底（蓝）：gpaGap ≤ −5 且 langGap ≤ 0 —— 用户水平明显高于门槛，稳拿志愿
- 主申（绿）：−5 < gpaGap ≤ 0 且 langGap ≤ 0.5 —— 过线或贴线，正常命中率
- 冲刺（黄）：0 < gpaGap ≤ 5 或 0.5 < langGap ≤ 1 —— 硬条件略逊于门槛
- 高风险（红）：gpaGap > 5 或 langGap > 1 —— 硬条件差距过大

叠加标记（可与任何互斥类同挂，页面单独橙色警示）：
- 先修风险（橙）：entryReq.prereqHard===true 且 match.explanations 存在 type="先修风险"
  —— GPA/语言再好也可能因先修不足被拒，宁可高标不可漏标

配语言班（langClass=true）且 0 < langGap ≤ 0.5：互斥类保持，badge 加"*"提示语言班路径。
```

### B. 预算可行性四档（实时重算）

> **⚠ 口径铁律：预算是「整个学制的家庭支持总额」，不是每年。** 很多家庭说"给你 XX 万"指的是读完为止的总数；
> 若按年判定，两年制项目会被系统性高估可行性。录入时必须问清是"总额"还是"每年"，
> 总额写 `profile.budget.cnyTotal`；确为每年额度时才写 `profile.budget.cnyPerYear`（脚本会按 学制年数 折算成总额）。
> 示例：家里给 15–20 万 → `cnyTotal: 200000`（按上限填，页面会同时显示下限缺口）。

```
学制年数 yrs = 从 duration 里解析（"2 年（120 ECTS）" → 2；解析不到按 1）
年花费 per = tuition.cny + livingCost.cny
全学制总花费 cost = per × yrs
预算总额 budget = profile.budget.cnyTotal（缺省时 = cnyPerYear × yrs）
全周期兼职上限 pt = partTime.incomeYearCnyMax × yrs
可计入奖学金 sch = Σ scholarships[].amountCnyMax（仅 countable=true 条目；
                 全奖型如 CSC 一律 countable=false，防把小概率大奖算进可行性）
总缺口 gap = cost − budget

档① 可行（绿）        gap ≤ 0：整个学制总花费都在家庭支持总额内
档② 加兼职可行（蓝）   0 < gap ≤ pt：缺口靠当地合法兼职（全周期）可补齐
档③ 兼职+奖学金（橙）  pt < gap ≤ pt+sch：要打满兼职且拿到可争取奖学金才够
档④ 超预算（红）       gap > pt+sch：家庭需增资或换校（可优先看 1 年制项目）
```

详情页必须展示 per / yrs / cost / budget / gap / pt / sch 与口径，四档结论不许只给标签不给算式。
**选校建议必须区分学制**：同预算下 1 年制与 2 年制的可行性差异是决定性的，不要混在一句"预算内"里。

### C. 页面筛选器与排序（生成方不需改逻辑，只需保证字段完整）

- 地区：从 DATA 动态生成 chips（region 开放枚举，全球任意地区）
- 预算档：①可行 / ②加兼职 / ③兼职+奖学金 / ④超预算（多选，按全学制总花费判定）
- 录取档：保底 / 主申 / 冲刺 / 高风险（多选）；先修风险为叠加标记，单独统计并高亮
- 匹配档：高/中/低（match.tier，生成时算好）
- 排序（卡片与对比表同时生效）：匹配度↓ / 志愿顺序（保底→主申→冲刺→高风险）/ 预算档①→④ / **全学制总花费**↑ / QS↑ / 兼职收入上限↓ / 可计入奖学金上限↓
- 关键词：校名/专业名中英文模糊匹配
- 双视图：卡片（14 维度展开）/ 对比表（横向比字段）

## PROFILE 常量（模板另一常量）

```json
{
  "name": "示例",
  "gpa": {"value": 85, "scale": "百分制加权", "schoolTier": "tier1"},
  "major": "地理信息科学",
  "courses": [{"name": "GIS原理", "score": 88}],
  "language": {"test": "IELTS", "overall": 6.5, "min": 6.0},
  "targetRegions": ["英国", "香港", "新加坡"],
  "budget": {"cnyTotal": 400000},   // 家庭可支持的「整个学制总额」（不是每年）；确为每年额度时才用 {"cnyPerYear": 200000}
  "goal": "就业回国"
}
```

页面顶部档案卡可编辑 GPA / 院校层次 / 语言 / **家庭支持总额（整个学制）**，改完**实时重算**录取四类、先修风险与预算四档；课程匹配度由生成时按课程清单测算，不随档案变化（要改匹配度必须重跑生成流程）。


## 独立数据源与构建流程（v2，2026-10）

技能不再「把数据写在 HTML 里」，而是：

```
assets/data.json        ← 唯一数据源（meta + profile + data[] + schoolLinks + regionLinks）
assets/exclusions.json  ← 结构化排除清单（school/program/reason/source/checkedDate）
assets/template.html    ← 纯模板，DATA 默认为空数组（内部有 <script id="payload"> 注入点）
scripts/build.js        ← 唯一构建入口：注入 + 前置自检 + 输出 HTML
```

**为什么这样改**：①脚本不再依赖 HTML 锚点做数据读取（改模板不会让脚本失效）②模板不含数据，杜绝"照抄上一版数据"③生成前强制自检，数据为空/字段缺失/无核验日期/链接缺口时直接失败，而不是渲染空白页。

### data.json 顶层结构

```json
{
  "meta": {"generatedDate":"","verifiedDateRange":"","fxNote":"","qsNote":"","disclaimer":"",
           "scopeNote":"本次检索范围与穷尽结论","today":"2026-10-02","planWindowDays":120,
           "thresholds":{"safeGap":-8,"mainHi":0.5,"reachGap":5,"reachLang":1}},
  "profile": {"name":"","gpa":{"value":85.0,"scale":"百分制加权","schoolTier":"tier2"},
              "major":"","language":{"test":"IELTS","overall":6.5,"min":6.0},
              "budget":{"cnyTotal":200000},"goal":"就业回国",
              "credits":{"total":168,"hoursPerCredit":16,"note":"示例学分口径"}},
  "data": [ /* 每校一条，字段见上 */ ],
  "schoolLinks": {"<id>": {"program":"","admissions":"","contact":{"email":"","phone":"","note":"","source":"","verifiedAt":""}}},
  "regionLinks": {"<region>": [["链接名","URL"]]},
  "exclusions": []
}
```

- `schoolLinks.<id>.contact`（强烈建议逐校补齐）：招生办**官方**邮箱/电话（从学校官网 contact/admissions 页实时核验，禁止凭记忆写）；`source` 记联系方式所在官方页 URL，`verifiedAt` 记核验日期。页面会在每张卡片渲染「联系招生办：✉ 邮箱 ☎ 电话」，配合页面顶部 AI 免责声明，引导用户向官方确认具体申请资格（先修认定、学历认证、均分口径、语言豁免等 AI 无法替官方拍板的事项）

- `meta.thresholds` 会覆盖模板默认阈值，页面顶部还能再手动调（保底线 / 冲刺线两个输入框）
- `meta.today` + `meta.planWindowDays` 决定「行动清单」的倒计时基准与窗口
- `meta.creditConversion`（可选）：`{"hoursPerEcts":27}`——学分换算 AI 估算口径（1 ECTS≈27 小时总学习量）；页面用它把 `profile.credits.total × hoursPerCredit` 折成 ECTS 当量对照 `entryReq.creditReq.ectsRequired`，给出「估算满足/估算不足」；官方换算以校方答复为准

### exclusions.json 结构（结构化排除留痕）

```json
[{"school":"根特大学","program":"MSc Geography and Geomatics","region":"比利时",
  "reason":"官方 PDF 标注 Dutch-taught，非英语项目","source":"https://…","checkedDate":"2026-10-02"}]
```

规则：**每条必须有 reason 与 source**（build.js 会校验）；理由要具体（语言不符 / 硬性先修缺失 / 均分差距过大 / 学费超预算 / 已停招 / 方向不符）；页面自动渲染为「排除清单」折叠区，用于回答"为什么没有 XX 学校"。


## 小语种项目（非英语授课）处理规范

本技能**不只做英语项目**。德/法/西/意/荷/日/韩等小语种授课项目按同一 schema 处理，只多两个字段：

| 字段 | 说明 |
|---|---|
| `entryReq.teachingLanguage` | 授课语言；部分模块双语时如实写（如「英语（部分模块德语）」），前端会归入「双语/多语」筛选组 |
| `entryReq.localLang` | 本地语言证明要求与语言班路径（**硬条件**，不达标直接被拒，无语言班兜底的项目尤其要注意） |

**必核验项**（比英授多三条）：
1. **授课语言**（官方用语：Unterrichtssprache / langue d'enseignement / idioma / 使用言語），别只看聚合站标注（已实测有聚合站把荷兰语项目标成英语）
2. **本地语言证明类型与分数线**（DSH-2 / TestDaF 4×4 / DELF B2 / TCF 400+ / DELE B2 / JLPT N2 / TOPIK 4…）
3. **语言班/预科路径是否存在**（德国 Studienkolleg、法国语言预科、Campus France 语言年、日本别科…）；有路径 ≠ 能兜底，要在 note 写清"须先达标才能注册专业"

**学费与学制口径**：德奥公立多为"学期费 + 部分州对非 EU 收费"；法国为差异化学费（约 €3,770/年）；意大利/西班牙按学分或大区分档；日本国立统一学费（约 ¥635,400/年）+ 入学金。**务必写清是否按国籍分档。**


## 三个「语言要求」必须分开（高频混淆点）

| 节点 | 含义 | 典型情况 |
|---|---|---|
| **入学语言** | 申请时提交（IELTS/TOEFL 或 DSH/DELF/JLPT…） | 见 `entryReq.language` / `entryReq.localLang` |
| **毕业语言** | 修完学分/写论文时是否需本地语证明 | 见 `graduationLang`。英授硕士**多数无**本地语毕业要求；执业类（医学/教育/法律/社会工作）与魁北克等**可能有** |
| **永居/入籍语言** | 申请身份时才考 | 见 `pr` / `citizenship`。荷兰 NT2、德国 B1、法国 B1、葡萄牙 A2、西班牙 A2…**几乎人人要考** |

**给用户的提醒口径**：读英授项目 ≠ 不用学本地语——**毕业可能不需要，但留下来工作/拿身份几乎一定要**。回答这类问题时必须把三个节点分开说，不要一句"不用本地语"糊过去。
