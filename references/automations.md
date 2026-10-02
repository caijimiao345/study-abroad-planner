# 定时监控任务模板（申请节点 + 签证政策）

两个任务：**A 申请节点监控**（每周）、**B 签证与政策监控**（每月）。  
发现变更时：Notion 连接可用就直接更新看板；不可用则写本地待同步文件。

> 创建方式：用 `automation_update`（mode=create）把下面对应的 `prompt` 与 `rrule` 原样填入，`cwds` 填工作目录。
> 若自动化服务暂不可用，可先把 prompt 存档，恢复后创建；或手动每周跑一次。

---

## A. 申请节点监控（每周一 09:00）

- `scheduleType`: recurring
- `rrule`: `FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0`
- `cwds`: 项目工作目录
- `prompt`:

```
监控留学申请关键日期与签证预约节奏，发现变更就更新看板。

【信息来源：只用官方源，禁用中介站/聚合站/留学论坛】
- 各校官网项目页的 application deadlines / how to apply 页面
- 移民局官网：gov.uk(英国)、immd.gov.hk(中国香港)、ica.gov.sg(新加坡)、homeaffairs.gov.au(澳洲)、
  canada.ca/IRCC(加拿大)、travel.state.gov(美国)、ind.nl(荷兰)、auswaertiges-amt.de(德国)、
  campusfrance.org(法国)、migrationsverket.se(瑞典)、migri.fi(芬兰)、immigration.govt.nz(新西兰)
- 中国学生专属流程：德国 APS(aps.org.cn)、意大利 Universitaly、马来西亚 EMGS

【步骤】
1. 读本地看板（上次记录）：
   - notion_模板/1_申请项目总表.csv（学校/专业/申请时间线/学签/核验状态）
   - notion_模板/3_申请签证时间线.csv（节点/官网时间/我的计划日期）
   - notion_模板/4_地区签证政策库.csv（政策/核验日期）
2. 抽查核验（优先最近到期的 5–8 所院校 + 用户目标地区）：
   - 申请开放/截止是否变化（分轮是否新增轮次）
   - 语言要求（含小分）、学费是否更新
   - 签证政策与预约等待时间是否变化
3. 对比后只有真实变化才动：
   - Notion 连接可用 → 更新对应行（表1 下一步动作/截止、表3 节点与状态、表4 政策与核验日期），
     备注写"变更来源 + 核验日期"
   - Notion 不可用 → 写入 notion_模板/_变更待同步.md，
     格式：表名 | 行标识 | 字段 | 旧值 → 新值 | 来源链接 | 发现日期
4. 输出简短简报：本周到期/逾期节点、发现的变更、待用户确认事项
5. 无变更时只更新核验日期字段，严禁为"显得有产出"制造改动

【数据纪律】每个数字可指向官网页面；无法核验写"未确认"，绝不编造日期或政策；政策字段带年份口径。
```

---

## B. 签证与政策监控（每月 5 日 10:00）

- `scheduleType`: recurring
- `rrule`: `FREQ=MONTHLY;BYMONTHDAY=5;BYHOUR=10;BYMINUTE=0`
- `cwds`: 项目工作目录
- `prompt`:

```
复核留学目标地区的签证/工签/永居/入籍政策与兼职规定，更新政策库。

【信息来源】各国移民局官网（gov.uk、immd.gov.hk、ica.gov.sg、homeaffairs.gov.au、canada.ca、
travel.state.gov、ind.nl、auswaertiges-amt.de、campusfrance.org、migrationsverket.se、migri.fi、
immigration.govt.nz、sem.admin.ch、polito? 用官方域）+ 中国使领馆/APS/Universitaly 等流程门户

【步骤】
1. 读 notion_模板/4_地区签证政策库.csv，筛出"下次复核"已到期的地区
2. 逐项核验并记录：学签类型/办理时长/官方链接、毕业后工签（类型+时长+条件）、
   永居（年限+条件）、入籍（年限+是否需放弃中国籍）、兼职上限（法定时长+是否需许可）
3. 有变化的：更新 Notion 或写 _变更待同步.md（同任务 A 的格式），并在备注写明"政策年份 + 来源"
4. 特别关注每年都在动的项：英国 Graduate Route、澳洲 485（年龄上限）、
   新加坡 EP 门槛/COMPASS、加拿大 PGWP 与 Express Entry、德国蓝卡薪资线、
   日本高度人才积分、荷兰融入考试要求
5. 输出：本次复核了哪些地区、哪些字段发生变化、哪些仍待确认

【纪律】不推测、不沿用旧年份数字；无法确认的写"未确认（上一版为 X，需人工复核）"。
```

---

## C. 手动兜底（自动化不可用时）

- 每两周手动执行一次任务 A 的 prompt
- 收到 offer 后：优先推进 表2 材料清单 + 表3 的签证节点，材料与签证顺序不要乱
- 任何政策数字在用于决策前，都要点开官方链接确认一次
