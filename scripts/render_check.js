// 用途：无浏览器环境下验证 HTML 是否真的渲染出卡片（DOM stub + vm 执行页面 JS）
// 用法：node render_check.js <html文件> [期望最少卡片数]
// 用最小 DOM stub 真跑页面 JS，检查是否真的渲染出卡片（并捕获异常）
const fs = require('fs');

// 主 JS 提取：取文件中最后一段 <script> 的内容（对平台重排 script 顺序更稳）
// 之前用 /<script[^>]*>[\s\S]*?<\/script>/g 再 .pop()，在个别文件上会被 payload 块或注入属性干扰。
function extractMainJs(html) {
  const openIdx = html.lastIndexOf('<script');
  if (openIdx < 0) throw new Error('未找到 <script> 块');
  const codeStart = html.indexOf('>', openIdx) + 1;
  const closeIdx = html.indexOf('</script>', codeStart);
  const js = html.slice(codeStart, closeIdx);
  if (/^\s*\{/.test(js)) throw new Error('最后一段 <script> 看起来是 JSON 而不是主 JS');
  return js;
}

const vm = require('vm');

const file = process.argv[2] || '比利时纯英语项目-选校对比.html';
const html = fs.readFileSync(file, 'utf8');
const payloadStr = (html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/) || [])[1];
const js = extractMainJs(html);

const stores = {};
function mkEl(id) {
  const el = {
    id, innerHTML: '', textContent: '', value: '', checked: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    insertAdjacentHTML() {}, insertAdjacentElement() { return el },
    closest() { return el }, querySelectorAll() { return [] }, querySelector() { return null },
    parentNode: null,
  };
  el.parentNode = { insertAdjacentHTML() {}, appendChild() {}, querySelectorAll() { return [] } };
  return el;
}
const els = {};
els['payload'] = mkEl('payload');
els['payload'].textContent = payloadStr || '{}';   // 关键：把注入的 JSON 喂给页面 JS 读取
const document = {
  getElementById(id) { if (!els[id]) els[id] = mkEl(id); return els[id] },
  createElement() { return mkEl('_new') },
  querySelectorAll() { return [] },
  addEventListener() {},
};
const localStorage = {
  getItem: k => (k in stores ? stores[k] : null),
  setItem: (k, v) => { stores[k] = String(v) },
};
const sandbox = { document, localStorage, console, JSON, Math, Date, parseInt, parseFloat, isNaN, Object, Array, String, Number, RegExp, Set, Error, encodeURIComponent, decodeURIComponent, setTimeout };
sandbox.window = sandbox; sandbox.globalThis = sandbox;

let err = null;
try {
  vm.createContext(sandbox);
  vm.runInContext('const PAYLOAD=' + (payloadStr || '{}') + ';\n' + js, sandbox, { timeout: 8000 });
} catch (e) {
  err = e;
}

const cardView = els['cardView'] ? els['cardView'].innerHTML : '';
const stats = els['stats'] ? els['stats'].innerHTML : '';
const cards = (cardView.match(/class="sch"/g) || []).length;
const excl = els['exclBody'] ? els['exclBody'].innerHTML : '';

console.log('文件:', file, '|', Math.round(html.length / 1024), 'KB');
console.log('payload JSON 长度:', payloadStr ? payloadStr.length : 0, '| 主 JS 长度:', js.length);
console.log('执行异常:', err ? ('❌ ' + err.message) : '✅ 无');
if (err) console.log(String(err.stack).split('\n').slice(0, 4).join('\n'));
console.log('渲染卡片数:', cards);
console.log('统计条:', stats.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160));
console.log('排除清单 HTML 长度:', excl.length, excl.length ? '（含表格 ✓）' : '（空）');
console.log('行动清单 HTML 长度:', els['planCard'] ? (els['planCard'].innerHTML || '').length : 0);
process.exit(cards > 0 && !err ? 0 : 1);