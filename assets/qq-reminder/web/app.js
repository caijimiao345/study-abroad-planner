/* 留学申请 · QQ 提醒管理前端（原生 JS，无构建）
 * API 走 Pages Functions 代理（/api/* → Worker），同源，无需 CORS。
 * API_BASE 为空即同源；本地开发可指向 Worker 地址。
 */
const API_BASE = ''; // 例如 'https://qq-study-reminder.xxx.workers.dev'（本地调试用）

const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('fr_token') || '';

// ── 登录 ──────────────────────────────────────────────────────────
$('token-save').addEventListener('click', () => {
  token = $('token-input').value.trim();
  localStorage.setItem('fr_token', token);
  init();
});

$('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('fr_token');
  location.reload();
});

async function init() {
  $('login-box').hidden = true;
  $('app').hidden = false;
  await loadReminders();
  await loadPushLog();
}

// ── API ───────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) };
  if (opts.body && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const resp = await fetch(API_BASE + path, { ...opts, headers });
  if (resp.status === 401) {
    localStorage.removeItem('fr_token');
    alert('口令无效，请重新输入');
    location.reload();
    throw new Error('unauthorized');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

// ── 提醒列表 ──────────────────────────────────────────────────────
let reminders = [];

async function loadReminders() {
  try {
    const { data } = await api('/api/reminders');
    reminders = data;
    renderList();
  } catch (e) {
    $('list-empty').hidden = false;
    $('list-empty').textContent = '加载失败：' + e.message;
  }
}

function fmt(d) { return d ? d.slice(5).replace('-', '/') : '已结束'; }

function renderList() {
  const box = $('reminder-list');
  box.innerHTML = '';
  $('count').textContent = `${reminders.length} 条`;
  $('list-empty').hidden = reminders.length > 0;
  for (const r of reminders) {
    const item = document.createElement('div');
    item.className = 'item' + (r.enabled ? '' : ' disabled');

    const left = document.createElement('div');
    const freq = r.frequency === 'weekly' ? '每周' : r.frequency === 'monthly' ? '每月' : '每天';
    const next = r.next_fire === null
      ? '已结束'
      : r.next_fire === 'today' || r.next_fire === (todayStr())
        ? '今日窗口'
        : `${fmt(r.next_fire)} 起`;
    left.innerHTML = `
      <div><span class="tag">${esc(r.type)}</span><span class="title">${esc(r.title)}</span></div>
      <div class="meta">目标 ${fmt(r.due_date)} · 提前 ${r.lead_days} 天 · ${freq} · ${next}</div>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
    `;

    const ops = document.createElement('div');
    ops.className = 'ops';
    const bEdit = document.createElement('button');
    bEdit.textContent = '编辑';
    bEdit.onclick = () => openForm(r);
    const bToggle = document.createElement('button');
    bToggle.textContent = r.enabled ? '停用' : '启用';
    bToggle.onclick = async () => {
      await api(`/api/reminders/${r.id}`, { method: 'PUT', body: { ...r, enabled: r.enabled ? 0 : 1 } });
      await loadReminders();
    };
    const bDel = document.createElement('button');
    bDel.textContent = '删除';
    bDel.className = 'danger';
    bDel.onclick = async () => {
      if (!confirm(`删除「${r.title}」？`)) return;
      await api(`/api/reminders/${r.id}`, { method: 'DELETE' });
      await loadReminders();
    };
    ops.append(bEdit, bToggle, bDel);

    item.append(left, ops);
    box.appendChild(item);
  }
}

function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── 新建 / 编辑表单 ───────────────────────────────────────────────
let editingId = null;

$('btn-new').addEventListener('click', () => openForm(null));
$('btn-reload').addEventListener('click', loadReminders);

function openForm(r) {
  editingId = r ? r.id : null;
  $('form-title').textContent = r ? '编辑提醒' : '新建提醒';
  $('f-type').value = r ? r.type : '申请';
  $('f-title').value = r ? r.title : '';
  $('f-due').value = r ? r.due_date : '';
  $('f-lead').value = r ? r.lead_days : 7;
  $('f-frequency').value = r ? r.frequency : 'daily';
  $('f-enabled').value = r ? (r.enabled ? '1' : '0') : '1';
  $('f-note').value = r ? r.note : '';
  $('form-msg').textContent = '';
  $('form-box').hidden = false;
  $('form-box').scrollIntoView({ behavior: 'smooth' });
}

$('btn-cancel').addEventListener('click', () => {
  $('form-box').hidden = true;
});

$('reminder-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    type: $('f-type').value.trim() || '通用',
    title: $('f-title').value.trim(),
    note: $('f-note').value.trim(),
    due_date: $('f-due').value,
    lead_days: Number($('f-lead').value),
    frequency: $('f-frequency').value,
    enabled: $('f-enabled').value === '1',
  };
  try {
    if (editingId) {
      await api(`/api/reminders/${editingId}`, { method: 'PUT', body });
    } else {
      await api('/api/reminders', { method: 'POST', body });
    }
    $('form-box').hidden = true;
    await loadReminders();
  } catch (err) {
    $('form-msg').textContent = err.message;
  }
});

// ── 推送记录 ──────────────────────────────────────────────────────
async function loadPushLog() {
  try {
    const { data } = await api('/api/push-log');
    const box = $('push-log');
    box.innerHTML = '';
    if (!data.length) {
      box.innerHTML = '<p class="hint">暂无推送记录（每日待办清单与技能简报发送后会显示在这里）。</p>';
      return;
    }
    for (const p of data.slice(0, 20)) {
      const item = document.createElement('div');
      item.className = 'item push-item';
      const src = p.source === 'cron' ? '定时清单' : p.source === 'skill' ? '技能简报' : p.source;
      item.innerHTML = `
        <div>
          <div><span class="tag">${src}</span>
              <span class="${p.status === 'sent' ? 'status-sent' : 'status-failed'}">${p.status === 'sent' ? '已发送' : '失败'}</span>
              <span class="when">${esc(p.sent_at)}</span></div>
          <pre class="meta" style="white-space:pre-wrap;margin-top:6px">${esc(p.preview)}</pre>
        </div>`;
      box.appendChild(item);
    }
  } catch (e) {
    $('push-log').innerHTML = `<p class="error">加载失败：${e.message}</p>`;
  }
}

// 已登录则直接进入
if (token) init();
