#!/usr/bin/env node
/** 从 data.json 生成 Notion 可导入的四张表 CSV（口径与页面一致）
 *  用法：node generate_notion_csv.js [data.json]
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

const OUT = process.argv[3] || path.resolve(SK, 'notion_模板');
fs.mkdirSync(OUT, { recursive: true });
const q = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const write = (name, header, rows) => {
  fs.writeFileSync(path.join(OUT, name), '\uFEFF' + [header.join(',')].concat(rows.map(r => r.map(q).join(','))).join('\r\n'), 'utf8');
  console.log(name, rows.length, '行');
};
write('1_申请项目总表.csv',
  ['学校','学校英文','国家/地区','专业方向','专业(中文)','专业(英文)','学制','开学季','QS排名','录取档','先修风险','课程匹配度','匹配档','匹配说明(逐条)',
   '均分线_985/211','均分线_双非','雅思要求','可配语言班','学费本币','币种','学费人民币/年','生活费人民币/年','年花费人民币','学制年数','全学制总花费人民币','家庭支持总额人民币','兼职年上限人民币','全周期兼职上限人民币','可计入奖学金人民币',
   '预算档','总缺口人民币','申请时间线','学签类型','学签办理时长','毕业后工签','工签政策年份','永居路径','入籍路径','专业官网','招生入口','地区政策链接','数据核验日期','核验状态','我的状态','下一步动作','备注'],
  DATA.map(d => { const a = admitVerdict(d), b = budgetCalc(d), L = P.schoolLinks[d.id] || {}, R = P.regionLinks[d.region] || [];
    return [d.school,d.schoolEn,d.region,d.field,d.programCn,d.program,d.duration,(d.intake||[]).join('/'),d.qsRank,
      a?a.cls:'',a&&a.risk?'是':'',d.match.score,d.match.tier,(d.match.explanations||[]).map(e=>'['+e.type+'] '+e.text).join(' / '),
      d.entryReq.gpaTier.tier1,d.entryReq.gpaTier.tier2,
      d.entryReq.language.ielts?(d.entryReq.language.ielts.overall+(d.entryReq.language.ielts.min!=null?'(小分'+d.entryReq.language.ielts.min+')':'')):'',
      d.entryReq.language.langClass?'可':'否',d.tuition.amount,d.tuition.currency,d.tuition.cny,d.livingCost.cny,b.per,b.yrs,b.cost,b.budget,
      d.partTime.incomeYearCnyMax,Math.round(b.pt),(d.scholarships||[]).filter(s=>s.countable).reduce((t,s)=>t+(s.amountCnyMax||0),0),
      B_LABEL[b.n],Math.round(b.gap),(d.timeline||[]).map(t=>t.date+' '+t.event).join(' → '),
      d.visa.type,d.visa.processingTime,d.workVisa.name+' '+d.workVisa.duration,d.workVisa.policyYear||'',
      d.pr.years,d.citizenship.years,L.program||'',L.admissions||'',R.map(x=>x[0]+': '+x[1]).join(' | '),
      d.verifiedDate,d.verified?'已核验':'待核验','未开始','','',d.admissionLogic]; }));
write('2_申请与签证材料清单.csv',
  ['阶段','材料项','是否必需','适用地区','出具方','时效/格式要求','状态','负责人','截止日期','备注'],
  [['申请','成绩单与均分证明（中英文盖章）','必需','全部','本科院校教务','双语密封件，部分直寄','未开始','','','与档案 GPA 口径一致'],
   ['申请','学位证/在读证明','必需','全部','本科院校','在读生出在读证明','未开始','','',''],
   ['申请','PS / 动机信','必需','全部','本人','按项目字数；规划类强调课程匹配与方法论','未开始','','','对照「课程匹配度」逐条呼应'],
   ['申请','CV / 简历','必需','全部','本人','突出项目、课程、实习','未开始','','',''],
   ['申请','推荐信','必需','全部','导师/实习主管','2 封常见；来源多样更佳','未开始','','','提前提醒老师 deadline'],
   ['申请','语言成绩','必需','全部','雅思/托福','注意小分与 2 年有效期','未开始','','','差 0.5 分也要尽早重考'],
   ['申请','作品集 / 设计作品','设计类必需','英·意·荷·比','本人','城市设计/建筑类硬门槛（KU Leuven ICFU 亦要求）','未开始','','','无作品集则此类项目不可申'],
   ['申请','研究计划书','研究型必需','日本/德国','本人','导师内诺制核心材料','未开始','','',''],
   ['申请','课程描述（ECTS 换算）','欧陆必需','比/荷/德/意','本人+教务','评估先修学分的关键（VUB case by case 评估）','未开始','','','写得越细越有利'],
   ['申请','学历公证 / 双认证','按国家','比/荷/德/意','公证处','Apostille 或双认证','未开始','','',''],
   ['录取后','接受 offer 与押金','必需','全部','本人','注意押金退还条件','未开始','','',''],
   ['录取后','签证前置文件（CAS/IPA/CoE/eVAL）','必需','英/新/马/澳','学校出具','D 签必备','未开始','','',''],
   ['签证','学生签证申请表与照片','必需','全部','本人','按官方表格版本','未开始','','',''],
   ['签证','资金证明','必需','全部','本人/父母/银行','按各国官方月标准×月数','未开始','','','不用中介惯例数字'],
   ['签证','体检 / 无犯罪（按国籍要求）','按地区','比/澳/英等','指定机构','比利时部分国籍要求无犯罪证明','未开始','','',''],
   ['入境后','市政厅登记 / 居留卡','必需','比利时/欧陆','当地市政厅','比利时入境 8 日内登记','未开始','','',''],
   ['持续','成绩与出勤','必需','全部','学校','影响工签与永居','未开始','','',''],
   ['持续','学生工合同与工时凭证','按需','比利时等','雇主','比利时学生合同有税收优惠','未开始','','','']]);
write('3_申请签证时间线.csv', ['学校','国家/地区','节点','官网时间','我的计划日期','状态','负责人动作','来源链接','备注'],
  DATA.flatMap(d => (d.timeline||[]).map(t => [d.school,d.region,t.event,t.date,'','未开始','',(P.schoolLinks[d.id]||{}).program||'','']))
    .concat([['全体','通用','材料定稿','主轮截止前 3 周','','未开始','对照材料清单勾选','',''],
             ['全体','通用','语言达标（含小分）','递签前 4–6 个月','','未开始','差 0.5 分也要重考','',''],
             ['全体','通用','资金证明准备','递签前 1–2 个月','','未开始','官方月标准口径','','']]));
const seen = {}; const rows4 = [];
DATA.forEach(d => { if (seen[d.region]) return; seen[d.region] = 1; const R = P.regionLinks[d.region] || [];
  rows4.push([d.region,d.visa.type,d.visa.processingTime,R.map(x=>x[0]+': '+x[1]).join('\n'),d.workVisa.name,d.workVisa.duration,d.workVisa.condition,
    d.pr.years+'；'+(d.pr.conditions||[]).join('；'),d.citizenship.years+'；'+(d.citizenship.conditions||[]).join('；'),d.partTime.hours,
    d.workVisa.policyYear||d.verifiedDate,'每 6 个月复核','政策每年变动，以官方链接为准']); });
write('4_地区签证政策库.csv', ['国家/地区','学生签证类型','学签办理时长','学签官方链接','毕业后工签','工签时长','工签条件','永居条件','入籍条件','兼职上限','政策年份','下次复核','备注'], rows4);
console.log('\n输出目录:', OUT, '| 记录', DATA.length, '条 | 排除清单', (P.exclusions||[]).length, '条');
