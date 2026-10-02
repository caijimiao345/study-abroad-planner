#!/usr/bin/env node
/**
 * build.js —— 留学选校对比页构建器（唯一推荐的生成入口）
 *
 * 用法：
 *   node build.js [输出HTML路径] [数据JSON路径]
 *   默认：输出 选校对比.html，数据取 <技能目录>/assets/data.json
 *
 * 流程：读模板 → 读数据 → **前置自检（不通过则退出，不产出 HTML）** → 注入 → 写文件 → 打印摘要
 *
 * 为什么要有这一步：模板本身不含数据（DATA 默认 []），所有生成都必须经过本脚本，
 * 从而在"数据为空 / 字段缺失 / 核验日期缺失 / 链接缺口"时就拦住，而不是渲染出一个空白页。
 */
const fs = require('fs');
const path = require('path');

const SK = __dirname + '/..';
const TEMPLATE = path.resolve(SK, 'assets/template.html');
const EXCLUSIONS = path.resolve(SK, 'assets/exclusions.json');

const outHtml = process.argv[2] || '选校对比.html';
const dataPath = process.argv[3] || path.resolve(SK, 'assets/data.json');

function die(msg, details) {
  console.error('\n❌ 构建中止：' + msg);
  if (details && details.length) details.slice(0, 40).forEach(d => console.error('   - ' + d));
  if (details && details.length > 40) console.error('   ... 其余 ' + (details.length - 40) + ' 条省略');
  console.error('\n（未产出 HTML。修正数据后重跑。）\n');
  process.exit(1);
}

// ── 读入 ──
if (!fs.existsSync(TEMPLATE)) die('模板不存在：' + TEMPLATE);
if (!fs.existsSync(dataPath)) die('数据文件不存在：' + dataPath + '（先写好 data.json，见 references/data-schema.md）');

const template = fs.readFileSync(TEMPLATE, 'utf8');
let payload;
try {
  payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (e) {
  die('数据 JSON 解析失败：' + e.message);
}
// 排除清单：数据内嵌 + 外部文件 合并去重（按 学校+项目）
// 优先级：与数据文件同目录的 exclusions.json ＞ 技能默认 assets/exclusions.json。
// 两条铁律：
// ① 技能默认那份只属于 assets/ 自带演示数据集；外部数据集（如 examples/、用户自己的目录）
//    没有同目录排除文件时**不得回退到默认**——否则比利时 7 条会混进荷兰/阿联酋页（实测踩过）。
// ② 任何外部来源的排除条目都按「地区交集」过滤兜底：地区不在本数据集内的条目直接丢弃。
const SIBLING_EXCL = path.join(path.dirname(dataPath), 'exclusions.json');
const OWN_DEMO_DIR = path.resolve(SK, 'assets');
const mergedExcl = [];
const seenExcl = new Set();
let exclSource = '仅数据内嵌';
const dataRegions = new Set((payload.data || []).map(d => d && d.region).filter(Boolean));
let droppedByRegion = 0;
function pushExcl(e, fromExternal) {
  if (!e || !e.school) return;
  if (fromExternal && e.region && dataRegions.size && !dataRegions.has(e.region)) { droppedByRegion++; return; }
  const k = e.school + '|' + (e.program || '');
  if (seenExcl.has(k)) return;
  seenExcl.add(k); mergedExcl.push(e);
}
(payload.exclusions || []).forEach(e => pushExcl(e, false));
if (fs.existsSync(SIBLING_EXCL)) {
  try { JSON.parse(fs.readFileSync(SIBLING_EXCL, 'utf8')).forEach(e => pushExcl(e, true)); exclSource = '同目录 exclusions.json'; }
  catch (e) { console.warn('⚠ 同目录 exclusions.json 解析失败，已跳过：' + e.message); }
} else if (path.dirname(path.resolve(dataPath)) === OWN_DEMO_DIR && fs.existsSync(EXCLUSIONS)) {
  try { JSON.parse(fs.readFileSync(EXCLUSIONS, 'utf8')).forEach(e => pushExcl(e, true)); exclSource = '技能默认 assets/exclusions.json（仅演示数据集可用）'; }
  catch (e) { /* 可选文件，忽略 */ }
}
payload.exclusions = mergedExcl;
if (droppedByRegion) console.warn('⚠ 按地区过滤丢弃了 ' + droppedByRegion + ' 条不属于本数据集的排除项（防跨国混入）');

// ── 前置自检 ──
const errs = [], warns = [];
const DATA = payload.data;
if (!Array.isArray(DATA) || DATA.length === 0) errs.push('data 为空数组或缺失 —— 模板默认无数据，必须注入真实数据');
const REQUIRED = ['id', 'field', 'school', 'schoolEn', 'region', 'program', 'programCn', 'duration', 'intake',
  'curriculum', 'tuition', 'livingCost', 'entryReq', 'materials', 'admissionLogic', 'timeline',
  'match', 'visa', 'career', 'salary', 'workVisa', 'pr', 'citizenship', 'partTime', 'scholarships', 'verified'];
const POLICY_FIELDS = ['visa', 'workVisa', 'pr', 'citizenship'];
(DATA || []).forEach((d, i) => {
  const tag = (d && (d.id || d.school)) || ('#' + i);
  if (!d || typeof d !== 'object') { errs.push(tag + '：不是对象'); return; }
  const miss = REQUIRED.filter(k => d[k] === undefined || d[k] === null || (Array.isArray(d[k]) && !d[k].length));
  if (miss.length) errs.push(tag + '：缺字段 ' + miss.join(','));
  if (!d.verifiedDate) errs.push(tag + '：缺 verifiedDate（核验日期为强制字段）');
  if (d.qsRank === undefined || d.qsRank === null) errs.push(tag + '：缺 qsRank（如该校不参与 QS 综合排名，请填 0 并在 subjectRank 说明）');
  if (!d.adminDivision) errs.push(tag + '：缺 adminDivision（州/大区；联邦制国家必填，其余可写国家名）');
  if (d.verified === true) {
    if (!Array.isArray(d.verifiedFields) || !d.verifiedFields.length)
      errs.push(tag + '：verified=true 但没有 verifiedFields（必须写明本轮实时核验了哪些字段/页面，否则不许标已核验）');
    if (!d.fetchedAt) errs.push(tag + '：verified=true 但没有 fetchedAt（实时抓取时间）');
  } else if (d.verifiedFields === undefined) {
    warns.push(tag + '：未标注核验范围（建议 verified=false + unverifiedNote 说明）');
  }
  POLICY_FIELDS.forEach(k => {
    if (d[k] && d[k].policyYear === undefined) errs.push(tag + '.' + k + '：缺 policyYear（政策年份，@plan 监控对齐用）');
  });
  if (d.tuition && typeof d.tuition.cny !== 'number') errs.push(tag + '：tuition.cny 非数字（需本币→人民币换算值）');
  if (d.livingCost && typeof d.livingCost.cny !== 'number') errs.push(tag + '：livingCost.cny 非数字');
  if (d.entryReq && (!d.entryReq.gpaTier || !d.entryReq.language)) errs.push(tag + '：entryReq 缺 gpaTier/language 子字段');
  if (d.match && (d.match.score === undefined || !Array.isArray(d.match.explanations) || !d.match.explanations.length))
    errs.push(tag + '：match 缺 score/explanations（匹配度必须带逐条解释）');
  if (d.partTime && typeof d.partTime.incomeYearCnyMax !== 'number') errs.push(tag + '：partTime.incomeYearCnyMax 非数字（预算四档的输入）');
  if (!d.verified) warns.push(tag + '：verified=false（页面会打待核验灰标，属正常）');
});
// 链接覆盖
const SL = payload.schoolLinks || {}, RL = payload.regionLinks || {};
(DATA || []).forEach(d => {
  if (d && d.id && !SL[d.id]) errs.push(d.id + '：缺 schoolLinks 条目（官网项目页/招生页）');
  if (d && d.region && !RL[d.region]) errs.push(d.region + '：缺 regionLinks 条目（学签/工签/永居官方链接）');
});
(payload.exclusions || []).forEach((e, i) => {
  if (!e || !e.reason || !e.school) errs.push('exclusions[' + i + ']：缺 school 或 reason（排除必须写明理由）');
});
// 结构校验（警告级）
const cnt = { 保底: 0, 主申: 0, 冲刺: 0, 高风险: 0 };
console.log('读入数据：' + (DATA || []).length + ' 条；地区 ' + new Set((DATA || []).map(d => d.region)).size +
  ' 个；专业方向 ' + new Set((DATA || []).map(d => d.field)).size + ' 个；排除清单 ' + payload.exclusions.length + ' 条（来源：' + exclSource + '）');

if (errs.length) die('自检未通过（' + errs.length + ' 项）', errs);

// ── 注入 ──
const json = JSON.stringify(payload).replace(/<\//g, '<\\/');   // 防 </script> 提前闭合
const marker = /<script id="payload" type="application\/json">[\s\S]*?<\/script>/;
if (!marker.test(template)) die('模板缺少 <script id="payload"> 注入点');
const html = template.replace(marker, '<script id="payload" type="application/json">' + json + '</script>');

// ── 成品语法门禁 ──
// 为什么要有：模板是「HTML 里嵌 JS 模板字面量」，一条拼接写错就会产出打不开的空白页
// （实测过一次：统计条拼接漏了反引号 → 页面 JS 直接 SyntaxError → 用户看到"没有结果"）。
// 这里用定位法取最后一段 <script>（主 JS）做语法编译，不通过则不产出文件。
(function syntaxGate() {
  const openIdx = html.lastIndexOf('<script');
  const codeStart = html.indexOf('>', openIdx) + 1;
  const closeIdx = html.indexOf('</script>', codeStart);
  const mainJs = html.slice(codeStart, closeIdx);
  try {
    new Function(mainJs);
  } catch (e) {
    die('成品页面 JS 语法错误（模板被改坏）', [e.message,
      '定位建议：node --check 提取出的主 JS；常见原因是模板字面量（反引号）拼接断裂，或字符串里出现未转义的 </script>']);
  }
})();

// ── 成品结构门禁 ──
// 为什么要有：以下两类 bug 在 render_check 的 DOM stub 下测不出来（stub 的 getElementById 永不返回
// null、payload 靠正则抓取），只有真浏览器才暴露，必须在构建期拦下：
// ① <script> 不配平：注释块漏写 </script>，浏览器会把紧随其后的 payload 块整段吞掉 → 白屏；
// ② 初始化顺序：cLang 等容器由 buildChips() 动态创建，bindChips 若先执行，
//    getElementById("cLang")===null → addEventListener 抛 TypeError → 初始化整体中断。
(function structureGate() {
  const opens = (html.match(/<script\b/g) || []).length;
  const closes = (html.match(/<\/script>/g) || []).length;
  if (opens !== closes)
    die('成品 HTML 的 <script> 标签不配平（' + opens + ' 开 / ' + closes + ' 闭）',
      ['常见于模板注释块漏写 </script>，浏览器会吞掉 payload → 白屏']);
  const openIdx = html.lastIndexOf('<script');
  const cs = html.indexOf('>', openIdx) + 1;
  const mainJs = html.slice(cs, html.indexOf('</script>', cs));
  const iBuild = mainJs.indexOf('buildChips();initMeta');
  const iBindLang = mainJs.indexOf('bindChips("cLang"');
  if (iBuild < 0 || iBindLang < 0 || iBuild > iBindLang)
    die('初始化顺序错误：buildChips() 必须先于 bindChips("cLang")（cLang 容器由 buildChips 动态创建，先绑定会在真浏览器抛 TypeError → 白屏）');
})();

fs.writeFileSync(outHtml, html, 'utf8');
console.log('\n✅ 构建完成 → ' + path.resolve(outHtml) + '  (' + (html.length / 1024).toFixed(0) + ' KB)');
if (warns.length) console.log('ℹ️  提示：' + warns.length + ' 条记录标记为「待核验」（页面已灰标）');
console.log('ℹ️  建议随后执行：node scripts/audit_dataset.js ' + dataPath + '  （字段与链接完整性审计）');