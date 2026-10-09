#!/usr/bin/env node
/**
 * compare_results.js —— 交付前比对：本次 data.json vs 上次 data.json
 *
 * 为什么要有它：重跑旧项目时，容易"凭上次的记忆改几个数"——既可能漏掉官网真实变化，
 * 也可能把上次的错误沿袭下来。本脚本把"与上次不同"的地方全部列出来，要求逐条回官网复核：
 *   · 官网真变了   → 保留本次值，并在交付说明里标注变更；
 *   · 本次检索有误 → 修正后重跑本比对；
 *   · 两次数据同样错 → 本脚本发现不了（比对 ≠ 核验），仍须按铁律零逐字段实时核验。
 *
 * 用法：
 *   node compare_results.js <本次data.json> <上次data.json>
 *
 * 输出：Markdown 报告到 stdout（清单增删 / 关键字段变化 / 排除清单变化）。
 * 退出码：0 = 报告已生成（有无差异均正常）；1 = 用法或读取错误。
 */
'use strict';
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node compare_results.js <本次data.json> <上次data.json>');
  process.exit(1);
}
const [newPath, oldPath] = args;

function loadJSON(p) {
  try {
    const t = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(t);
  } catch (e) {
    console.error('❌ 读取/解析失败: ' + p + ' → ' + e.message);
    process.exit(1);
  }
}
const NEW = loadJSON(newPath);
const OLD = loadJSON(oldPath);
const NEWDATA = Array.isArray(NEW.data) ? NEW.data : [];
const OLDDATA = Array.isArray(OLD.data) ? OLD.data : [];

// 匹配键：学校｜项目（英文原名）；退化用 id。项目改名 → 视为“新增/移除”，由人判别。
const keyOf = d => (d && d.school && d.program) ? (d.school + '｜' + d.program)
  : (d && d.id) || '?';
function index(arr) {
  const m = new Map();
  arr.forEach(d => { const k = keyOf(d); if (!m.has(k)) m.set(k, d); });
  return m;
}
const nm = index(NEWDATA), om = index(OLDDATA);

// ── 关键字段清单（影响选校决策的全部可比较字段）──
const fmt = v => {
  if (v === undefined || v === null || v === '') return '（无）';
  if (Array.isArray(v)) return v.join(' / ') || '（空）';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const cut = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
const FIELDS = [
  ['QS 排名',      d => d.qsRank === 0 ? '不适用（未参与 QS 综合排名）' : d.qsRank],
  ['招生人数',     d => d.enrollment],
  ['作品集',       d => { const p = d.portfolio; if (!p || p.required === undefined) return null;
    const t = p.required === true ? '必需' : p.required === false ? '不要求' : '待核验';
    return t + (p.detail ? '｜' + p.detail : ''); }],
  ['学制',         d => d.duration],
  ['入学时间',     d => d.intake],
  ['学费（本币）', d => { const t = d.tuition || {}; return t.amount ? ((t.currency || '') + ' ' + t.amount) : null; }],
  ['学费（人民币）', d => (d.tuition || {}).cny],
  ['生活费（人民币）', d => (d.livingCost || {}).cny],
  ['雅思（总分/小分）', d => { const i = ((d.entryReq || {}).language || {}).ielts; return i ? (i.overall + (i.min != null ? '/' + i.min : '')) : null; }],
  ['均分线（985/211）', d => ((d.entryReq || {}).gpaTier || {}).tier1],
  ['均分线（双非）', d => ((d.entryReq || {}).gpaTier || {}).tier2],
  ['工作经验要求', d => { const w = ((d.entryReq || {}).workExp) || {}; return w.required === true ? '必须有' : w.required === false ? '不要求' : '待核验'; }],
  ['学分门槛（ECTS）', d => ((d.entryReq || {}).creditReq || {}).ectsRequired],
  ['薪资（本币）', d => (d.salary || {}).amount],
  ['薪资（人民币）', d => (d.salary || {}).cny],
  ['毕业后工签',   d => (d.workVisa || {}).duration],
  ['永居路径',     d => (d.pr || {}).years],
  ['入籍路径',     d => (d.citizenship || {}).years],
  ['兼职年收入上限', d => (d.partTime || {}).incomeYearCnyMax],
  ['申请时间线',   d => (d.timeline && d.timeline.length) ? d.timeline.map(t => (t.date || '') + ':' + (t.event || '')).join('；') : null],
  ['核验日期',     d => d.verifiedDate],
  ['核验状态',     d => d.verified === true ? '已核验' : '待核验'],
];

const out = [];
const w = s => out.push(s);
w('# 交付前比对报告（本次 vs 上次）');
w('');
w('- 本次：`' + newPath + '`（' + NEWDATA.length + ' 条）');
w('- 上次：`' + oldPath + '`（' + OLDDATA.length + ' 条）');
w('- 匹配键：学校｜项目（英文原名）');
w('');

// ── 一、清单差异 ──
const added = NEWDATA.filter(d => !om.has(keyOf(d)));
const removed = OLDDATA.filter(d => !nm.has(keyOf(d)));
w('## 一、清单差异');
w('');
if (!added.length && !removed.length) {
  w('无：两次的学校×项目清单一致（' + NEWDATA.length + ' 条）。');
} else {
  if (added.length) {
    w('### 新增（本次有、上次无）：' + added.length + ' 条');
    added.forEach(d => w('- ' + keyOf(d)));
    w('');
    w('> 新增条目必须确认：是新检索到的候选，还是上次漏检？若因新增而扩大了范围，记得同步排除清单。');
  }
  if (removed.length) {
    w('');
    w('### 移除（上次有、本次无）：' + removed.length + ' 条');
    removed.forEach(d => w('- ' + keyOf(d)));
    w('');
    w('> ⚠️ 移除条目必须逐条确认：是项目停招/不再符合（应写入排除清单留痕），还是本次漏检（应补回）？');
  }
}
w('');

// ── 二、关键字段差异 ──
const diffsFor = [];
let fieldDiffCount = 0;
nm.forEach((nd, k) => {
  const od = om.get(k);
  if (!od) return;
  const rows = [];
  FIELDS.forEach(([label, get]) => {
    const a = fmt(get(od)), b = fmt(get(nd));
    if (a !== b) rows.push([label, a, b]);
  });
  if (rows.length) { diffsFor.push([k, rows]); fieldDiffCount += rows.length; }
});
w('## 二、关键字段差异（逐条回官网复核后处理）');
w('');
if (!diffsFor.length) {
  w('无：两次数据的所有关键字段一致。');
  w('');
} else {
  diffsFor.forEach(([k, rows], i) => {
    w('### ' + (i + 1) + '. ' + k);
    w('');
    w('| 字段 | 上次 | 本次 |');
    w('|---|---|---|');
    rows.forEach(([label, a, b]) => w('| ' + label + ' | ' + cut(a, 160).replace(/\|/g, '\\|') + ' | ' + cut(b, 160).replace(/\|/g, '\\|') + ' |'));
    w('');
  });
}

// ── 三、按国入选数对账（某国下降 >20% 必须交代去向）──
// 为什么单独一段：清单增删只能看出「少了哪几条」，看不出「某个国家整体缩水了」——
// 后者正是多国任务最典型的偷懒（某国只象征性查了两条）。按 region 聚合 + 变化率，
// 把需要交代的国家直接点名。
const cntBy = (arr) => {
  const m = new Map();
  arr.forEach(d => { const k = (d && d.region) || '（未填地区）'; m.set(k, (m.get(k) || 0) + 1); });
  return m;
};
const nc = cntBy(NEWDATA), oc = cntBy(OLDDATA);
const regions = [...new Set([...oc.keys(), ...nc.keys()])].sort();
const flaggedCountries = [];
w('## 三、按国入选数对账（某国入选数比上轮下降 >20% 必须交代去向）');
w('');
if (!regions.length) {
  w('无数据可比对。');
} else {
  w('| 国家/地区 | 上轮 | 本轮 | 条数变化 | 变化率 | 状态 |');
  w('|---|---|---|---|---|---|');
  regions.forEach(r => {
    const a = oc.get(r) || 0, b = nc.get(r) || 0, diff = b - a;
    const pct = a > 0 ? diff / a * 100 : null;
    let status;
    if (a === 0 && b > 0) { status = '新增国家（对照上轮无基数）'; flaggedCountries.push(r + '（新增国家）'); }
    else if (a > 0 && b === 0) { status = '⚠️ 本轮清零——项目停招还是漏检？'; flaggedCountries.push(r + '（本轮清零）'); }
    else if (pct !== null && pct <= -20) { status = '⚠️ 下降超 20%——必须交代去向'; flaggedCountries.push(r + '（下降 ' + pct.toFixed(1) + '%）'); }
    else status = '正常波动';
    const pctTxt = pct === null ? '—' : (diff >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    w('| ' + r + ' | ' + a + ' | ' + b + ' | ' + (diff === 0 ? '0' : (diff > 0 ? '+' + diff : String(diff))) + ' | ' + pctTxt + ' | ' + status + ' |');
  });
  w('');
  if (flaggedCountries.length) {
    w('**⚠️ 以下国家/地区必须逐个交代去向，不许静默变少**：');
    flaggedCountries.forEach(f => w('- ' + f));
    w('');
    w('交代方式（逐国给证据，二选一）：');
    w('  · 进排除清单并给官方来源（说明这轮为什么进不了：停招 / 语言不符 / 硬先修缺失 / 超预算 / 方向不符…）；');
    w('  · 或回补检索把漏校找回来，然后重跑本比对，直到该国回到阈值内或差异有明确结论。');
  } else {
    w('✅ 各国入选数无异常下降（下降幅度均在 20% 以内）。');
  }
}
w('');

// ── 四、排除清单变化（轻量对比）──
const ne = Array.isArray(NEW.exclusions) ? NEW.exclusions : [];
const oe = Array.isArray(OLD.exclusions) ? OLD.exclusions : [];
const eKey = e => (e && e.school || '?') + '｜' + (e && e.program || '');
const nset = new Set(ne.map(eKey)), oset = new Set(oe.map(eKey));
const eAdded = ne.filter(e => !oset.has(eKey(e)));
const eRemoved = oe.filter(e => !nset.has(eKey(e)));
w('## 四、排除清单变化');
w('');
if (!eAdded.length && !eRemoved.length) {
  w('无：排除清单一致（本次 ' + ne.length + ' 条 / 上次 ' + oe.length + ' 条）。');
} else {
  if (eAdded.length) {
    w('- 新增排除 ' + eAdded.length + ' 条：' + eAdded.map(e => eKey(e)).join('；'));
  }
  if (eRemoved.length) {
    w('- 减少排除 ' + eRemoved.length + ' 条：' + eRemoved.map(e => eKey(e)).join('；') +
      '（确认是恢复候选还是本次漏写排除理由）');
  }
}
w('');

// ── 汇总与下一步 ──
w('## 五、汇总与下一步');
w('');
w('- 新增 ' + added.length + ' 条 / 移除 ' + removed.length + ' 条 / 字段差异 ' + fieldDiffCount +
  ' 处（涉及 ' + diffsFor.length + ' 条记录）');
w('- 按国对账：' + regions.length + ' 个国家/地区，**需交代去向 ' + flaggedCountries.length + ' 个**' +
  (flaggedCountries.length ? '（' + flaggedCountries.join('；') + '）' : ''));
w('- **下一步（硬流程）**：对上面每一项差异回官网复核——');
w('  · 官网确实变了 → 保留本次值，并在交付说明里标注该变更；');
w('  · 本次检索/录入有误 → 修正数据后重跑本比对，直到差异全部有明确结论；');
w('  · 上次数据有误且官网未变 → 说明上次是错的，本次修正即可（同样要复核确认）。');
w('- 提醒：比对只找"与上次不同"，**不能代替官网核验**（两次数据同样错的情况发现不了）；');
w('  本次数据仍须满足铁律零：关键字段逐项实时核验、带来源与核验日期。');
w('');

process.stdout.write(out.join('\n') + '\n');
