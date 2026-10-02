// 用途：把「靠 JS 渲染」的成品页烤成「静态 HTML 快照」，供不支持执行 JS 的预览器使用。
// 用法：node snapshot_static.js <源html> <输出html>
// 原理：用 DOM stub 跑一遍页面 JS（与 render_check.js 同一套桩），把渲染后的 innerHTML 直接写回文档。
const fs = require('fs');
const vm = require('vm');

const src = process.argv[2] || '比利时纯英语项目-选校对比.html';
const out = process.argv[3] || '比利时结果-静态快照.html';
const html = fs.readFileSync(src, 'utf8');
const payloadStr = (html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/) || [])[1] || '{}';

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


const js = extractMainJs(html);

const stores = {};
const els = {};
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
els['payload'] = mkEl('payload');
els['payload'].textContent = payloadStr;

const document = {
  getElementById(id) { if (!els[id]) els[id] = mkEl(id); return els[id] },
  createElement() { return mkEl('_new') },
  querySelectorAll() { return [] },
  addEventListener() {},
};
const localStorage = { getItem: k => (k in stores ? stores[k] : null), setItem: (k, v) => { stores[k] = String(v) } };
const sandbox = { document, localStorage, console, JSON, Math, Date, parseInt, parseFloat, isNaN, Object, Array, String, Number, RegExp, Set, Error, encodeURIComponent, decodeURIComponent, setTimeout };
sandbox.window = sandbox; sandbox.globalThis = sandbox;

let err = null;
try {
  vm.createContext(sandbox);
  vm.runInContext('const PAYLOAD=' + payloadStr + ';\n' + js, sandbox, { timeout: 8000 });
} catch (e) { err = e; }

// 收集所有被写入过内容的容器 id（排除 payload 自身）
const rendered = {};
for (const [id, el] of Object.entries(els)) {
  if (id === 'payload') continue;
  const v = (el && (el.innerHTML || el.textContent)) || '';   // 纯文本容器用 textContent
  if (v) rendered[id] = v;
}

// 样式：把源文件里所有 <style> 原样搬过来
const styles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
// 页头标题
const titleM = html.match(/<title>([\s\S]*?)<\/title>/);
const title = titleM ? titleM[1] : '选校对比';

// 取出源文档 body 里非 script 的骨架（工具栏等），再叠上渲染结果
const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
let bodySkeleton = bodyM ? bodyM[1] : html;
// 去掉所有 script
bodySkeleton = bodySkeleton.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
// 逐个把已渲染容器的内容塞回去
let filled = 0;
for (const [id, content] of Object.entries(rendered)) {
  const re = new RegExp('(<[a-zA-Z0-9]+[^>]*id="' + id + '"[^>]*>)([\\s\\S]*?)(</[a-zA-Z0-9]+>)');
  if (re.test(bodySkeleton)) {
    bodySkeleton = bodySkeleton.replace(re, (m, a, b, c) => a + content + c);
    filled++;
  } else {
    // 容器不在骨架里（例如由 JS 动态创建），追加到 body 末尾
    bodySkeleton += '\n<section style="max-width:1200px;margin:16px auto;padding:0 16px"><div id="' + id + '_snap">' + content + '</div></section>';
  }
}

// 快照没有 JS 交互，卡片详情必须默认全部展开——否则奖学金/助学金、费用口径、排除理由等
// 折叠区信息在快照里永远看不到（曾实测被误判为「数据没写进去」）。
bodySkeleton = bodySkeleton.replace(/<div class="sch" data-id=/g, '<div class="sch open" data-id=');

const banner = '<div style="max-width:1200px;margin:12px auto;padding:10px 14px;border:1px solid #f0c36d;background:#fff8e6;border-radius:8px;font-size:13px;color:#7a5b00">' +
  '<b>静态快照</b>：这是把页面 JS 的渲染结果直接烤进 HTML 的版本，<b>不需要执行脚本即可查看</b>（筛选/排序交互不可用）。带交互的完整版请看源文件。</div>';

const outHtml = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + title + '（静态快照）</title>\n' + styles + '\n</head>\n<body>\n' + banner + '\n' + bodySkeleton + '\n</body>\n</html>\n';

fs.writeFileSync(out, outHtml, 'utf8');

const cardView = rendered['cardView'] || '';
const cards = (cardView.match(/class="sch"/g) || []).length;
console.log('源文件:', src);
console.log('执行异常:', err ? ('❌ ' + err.message) : '✅ 无');
console.log('填充的容器数:', filled, '| 渲染卡片数:', cards);
console.log('输出:', out, '|', Math.round(outHtml.length / 1024), 'KB');
process.exit(cards > 0 && !err ? 0 : 1);
