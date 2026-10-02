#!/usr/bin/env node
/** 数据集审计：字段完整性 / 链接覆盖 / 核验日期 / 政策年份 / 结构分布
 *  用法：node audit_dataset.js [data.json]
 *  默认读取 <技能目录>/assets/data.json（不依赖 HTML，可直接评审数据结构）
 */
const fs = require('fs');
const path = require('path');
const SK = __dirname + '/..';
const dataPath = process.argv[2] || path.resolve(SK, 'assets/data.json');
if (!fs.existsSync(dataPath)) { console.error('数据文件不存在：' + dataPath); process.exit(1); }
const P = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const DATA = P.data || [];
// ── 排除清单：与 build.js 同一口径（数据内嵌 + 外部文件按 学校+项目 去重）──
// 优先级：同目录 exclusions.json ＞ 技能默认 assets/exclusions.json。
// 铁律：技能默认那份只属于 assets/ 自带演示数据集，外部数据集不得回退（防比利时条目混入他国页）；
// 外部条目一律按「地区交集」过滤兜底。
const exclMerged = [], seenExcl = new Set();
const SIBLING = path.join(path.dirname(dataPath), 'exclusions.json');
const DEFAULT_EXCL = path.resolve(SK, 'assets/exclusions.json');
const OWN_DEMO_DIR = path.resolve(SK, 'assets');
const dataRegions = new Set(DATA.map(d => d && d.region).filter(Boolean));
const exclSrc = { inline: 0, file: 0, dropped: 0, which: '（无外部文件）' };
function pushExcl(e, fromExternal) {
  if (!e || !e.school) return;
  if (fromExternal && e.region && dataRegions.size && !dataRegions.has(e.region)) { exclSrc.dropped++; return; }
  const k = e.school + '|' + (e.program || '');
  if (seenExcl.has(k)) return;
  seenExcl.add(k); exclMerged.push(e);
}
(P.exclusions || []).forEach(e => { exclSrc.inline++; pushExcl(e, false); });
let exclFile = null;
if (fs.existsSync(SIBLING)) { exclFile = SIBLING; exclSrc.which = '同目录 exclusions.json'; }
else if (path.dirname(path.resolve(dataPath)) === OWN_DEMO_DIR && fs.existsSync(DEFAULT_EXCL)) { exclFile = DEFAULT_EXCL; exclSrc.which = '技能默认 assets/exclusions.json（仅演示数据集可用）'; }
if (exclFile) {
  try {
    const ext = JSON.parse(fs.readFileSync(exclFile, 'utf8'));
    if (Array.isArray(ext)) ext.forEach(e => { exclSrc.file++; pushExcl(e, true); });
  } catch (e) { console.log('⚠ 排除清单解析失败（已跳过）：' + exclFile + ' — ' + e.message); }
}
if (exclSrc.dropped) console.log('⚠ 按地区过滤丢弃了 ' + exclSrc.dropped + ' 条不属于本数据集的排除项（防跨国混入）');

const TH = (P.meta && P.meta.thresholds) || { safeGap: -8, mainHi: 0.5, reachGap: 5, reachLang: 1 };
const PROF = P.profile || {};
function langReq(s) {
  const l = s.entryReq && s.entryReq.language; if (!l) return null;
  if (PROF.language && PROF.language.test === 'TOEFL' && l.toefl) return { overall: l.toefl.overall, min: null };
  return l.ielts || null;
}
function admitVerdict(s) {
  const r = s.entryReq; if (!r || !r.gpaTier) return null;
  const line = parseFloat(PROF.gpa.schoolTier === 'tier1' ? r.gpaTier.tier1 : r.gpaTier.tier2) || 85;
  const gpaGap = line - PROF.gpa.value;
  const rq = langReq(s); let langGap = 0;
  if (rq && rq.overall != null) {
    langGap = Math.max(langGap, rq.overall - PROF.language.overall);
    if (rq.min != null) langGap = Math.max(langGap, rq.min - PROF.language.min);
  }
  let cls;
  if (gpaGap <= TH.safeGap && langGap <= 0) cls = '保底';
  else if (gpaGap <= 0 && langGap <= TH.mainHi) cls = '主申';
  else if (gpaGap <= TH.reachGap || langGap <= TH.reachLang) cls = '冲刺';
  else cls = '高风险';
  const risk = (r.prereqHard === true) || ((s.match && s.match.explanations) || []).some(e => e.type === '先修风险');
  return { cls, risk, gpaLine: line, gpaGap, langGap };
}
// 预算口径：家庭支持为「总额」，按学制年限折算全周期
function yearsOf(s){const m=String((s&&s.duration)||'').match(/(\d+(?:\.\d+)?)\s*年/);return m?parseFloat(m[1]):1}
function budgetCapOf(s){const bg=PROF.budget||{};
  if(bg.cnyTotal!=null&&bg.cnyTotal>0)return{budget:bg.cnyTotal,basis:'档案填写的家庭支持总额'};
  if(bg.cnyPerYear!=null&&bg.cnyPerYear>0)return{budget:Math.round(bg.cnyPerYear*yearsOf(s)),basis:'按 年预算 × 学制年数 折算'};
  return{budget:0,basis:'档案未填预算'}}
function budgetCalc(s) {
  const per = (s.tuition ? s.tuition.cny : 0) + (s.livingCost ? s.livingCost.cny : 0);
  const yrs = s.years || yearsOf(s);
  const cost = Math.round(per * yrs);
  const cap = budgetCapOf(s);
  const gap = cost - cap.budget;
  const pt = (s.partTime ? (s.partTime.incomeYearCnyMax || 0) : 0) * yrs;
  const sch = (s.scholarships || []).filter(x => x.countable).reduce((a, x) => a + (x.amountCnyMax || 0), 0);
  let n; if (gap <= 0) n = 1; else if (gap <= pt) n = 2; else if (gap <= pt + sch) n = 3; else n = 4;
  return { gap, pt, sch, n, per, yrs, cost, budget: cap.budget, basis: cap.basis };
}
const B_LABEL = { 1: '① 可行', 2: '② 加兼职可行', 3: '③ 兼职+奖学金', 4: '④ 超预算' };

const REQUIRED = ['id','field','school','schoolEn','region','program','programCn','duration','intake','qsRank',
  'curriculum','tuition','livingCost','entryReq','materials','admissionLogic','timeline','match','visa','career',
  'salary','workVisa','pr','citizenship','partTime','scholarships','verified','verifiedDate'];
const SL = P.schoolLinks || {}, RL = P.regionLinks || {};
const bad = [];
DATA.forEach(d => {
  const miss = REQUIRED.filter(k => d[k] === undefined || d[k] === null || (Array.isArray(d[k]) && !d[k].length));
  const sub = [];
  if (!d.entryReq || !d.entryReq.gpaTier || !d.entryReq.language) sub.push('entryReq 子字段');
  if (!d.match || d.match.score === undefined || !(d.match.explanations || []).length) sub.push('match');
  if (!d.tuition || typeof d.tuition.cny !== 'number') sub.push('tuition.cny');
  if (!d.livingCost || typeof d.livingCost.cny !== 'number') sub.push('livingCost.cny');
  if (!d.partTime || typeof d.partTime.incomeYearCnyMax !== 'number') sub.push('partTime.incomeYearCnyMax');
  ['visa','workVisa','pr','citizenship'].forEach(k => { if (!d[k] || !d[k].policyYear) sub.push(k + '.policyYear'); });
  if (!SL[d.id]) sub.push('缺 schoolLinks');
  if (!RL[d.region]) sub.push('缺 regionLinks');
  if (miss.length || sub.length) bad.push([d.id, d.region, miss.join(','), sub.join(',')]);
});
console.log('总记录:', DATA.length, '| 异常:', bad.length);
bad.forEach(b => console.log('  ', b.join(' | ')));
const regions = [...new Set(DATA.map(d => d.region))];
const fields = [...new Set(DATA.map(d => d.field))];
console.log('地区', regions.length, '个 | 专业方向', fields.length, '个 | 排除清单', exclMerged.length, '条（数据内嵌 ' + exclSrc.inline + ' + 外部文件 ' + exclSrc.file + '，来源：' + exclSrc.which + '，去重后）');
const EXCL_REASONS = exclMerged.filter(e => !e.reason || !e.school);
if (EXCL_REASONS.length) console.log('  ⚠ 排除条目缺 school/reason：', EXCL_REASONS.length, '条');
const byReason = {};
exclMerged.forEach(e => { const k = e.category || (e.reason || '').slice(0, 14) || '未分类'; byReason[k] = (byReason[k] || 0) + 1; });
console.log('  排除理由分布:', JSON.stringify(byReason));
const cnt = {}, bc = {};
DATA.forEach(d => { const a = admitVerdict(d), b = budgetCalc(d);
  if (a) { cnt[a.cls] = (cnt[a.cls] || 0) + 1; if (a.risk) cnt['⚠先修风险'] = (cnt['⚠先修风险'] || 0) + 1; }
  bc['B' + b.n] = (bc['B' + b.n] || 0) + 1; });
console.log('录取分布:', JSON.stringify(cnt), '| 预算分布:', JSON.stringify(bc));
console.log('已核验', DATA.filter(d => d.verified).length, '条 / 待核验', DATA.filter(d => !d.verified).length, '条');
const low = DATA.filter(d => (d.tuition.cny + d.livingCost.cny) <= 150000);
console.log('低学费档（≤15 万/年）:', low.length, '条', low.map(d => d.school + '/' + d.programCn).slice(0, 8).join('；'));
process.exit(bad.length ? 1 : 0);
