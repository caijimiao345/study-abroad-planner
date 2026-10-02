#!/usr/bin/env node
/** 判定口径离线校验：按当前档案跑录取四类与预算四档，核对分布是否合理
 *  用法：node verify_rules.js [data.json]
 *  默认读取 <技能目录>/assets/data.json（不依赖 HTML，可直接评审数据结构）
 */
const fs = require('fs');
const path = require('path');
const SK = __dirname + '/..';
const dataPath = process.argv[2] || path.resolve(SK, 'assets/data.json');
if (!fs.existsSync(dataPath)) { console.error('数据文件不存在：' + dataPath); process.exit(1); }
const P = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const DATA = P.data || [];
// ── 判定口径（与 references/data-schema.md 一致；本脚本不依赖任何 HTML）──
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

console.log('档案：', PROF.name || '—', '| GPA', PROF.gpa.value, PROF.gpa.schoolTier, '| 语言', PROF.language.overall + '/' + PROF.language.min, '| 预算', (PROF.budget.cnyTotal!=null?PROF.budget.cnyTotal:PROF.budget.cnyPerYear));
console.log('阈值：', JSON.stringify(TH));
DATA.forEach(d => {
  const a = admitVerdict(d), b = budgetCalc(d);
  console.log(('[' + d.region + '] ').padEnd(9) + (d.school || '').slice(0, 14).padEnd(16),
    (a ? a.cls : '-').padEnd(4), a && a.risk ? '⚠先修风险' : '  ', B_LABEL[b.n].padEnd(12),
    '缺口' + Math.round(b.gap / 1000) + 'k', 'pt' + Math.round(b.pt / 1000) + 'k', 'sch' + Math.round(b.sch / 1000) + 'k');
});
