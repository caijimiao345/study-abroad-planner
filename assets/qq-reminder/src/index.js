/**
 * QQ 留学提醒系统 · Cloudflare Worker
 *
 * 职责：
 *  1) REST API —— 前端管理自定义提醒（/api/reminders CRUD、/api/push-log）
 *  2) Cron（北京时间每日 08:00）—— 扫提醒窗口期，组装「今日待办清单」发到 QQ 群
 *  3) 网关（/api/push）—— 接收豆包技能定时任务的简报，原样转发到 QQ 群
 *
 * 环境变量（wrangler.toml / wrangler secret put）：
 *  QQ_APP_ID / QQ_APP_SECRET(secret) / QQ_GROUP_OPENID
 *  PUSH_GATEWAY_TOKEN(secret) / FRONTEND_TOKEN(secret) / ALLOWED_ORIGIN（CORS 白名单）
 *  MESSAGE_PREFIX（可选，出群消息统一前缀；留空=不加）
 * Binding：DB(D1) / QQ_TOKEN_KV(KV)
 */
export default {
  // ─────────────────────────────── 每日定时 ───────────────────────────────
  async scheduled(event, env, ctx) {
    const today = todayCn();
    console.log(`[cron] ${today} 开始扫描提醒窗口`);
    const due = await listDueReminders(env, today);
    if (due.length === 0) {
      console.log(`[cron] ${today} 无窗口期提醒，不发消息`);
      return;
    }
    const text = buildDailyDigest(due, today);
    try {
      const res = await sendGroupMessage(env, text);
      // 发送成功 → 逐条写 sent_log（daily 按天去重；weekly 按 7 天窗口去重）
      for (const r of due) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO sent_log (reminder_id, fire_date) VALUES (?, ?)`
        ).bind(r.id, today).run();
      }
      await logPush(env, 'cron', decorate(env, text), 'sent');
      console.log(`[cron] 已发送待办清单（${due.length} 项）→ ${res.id || 'ok'}`);
    } catch (e) {
      await logPush(env, 'cron', decorate(env, text), 'failed');
      console.error(`[cron] 发送失败: ${e.message}`);
    }
  },

  // ─────────────────────────────── HTTP 入口 ──────────────────────────────
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS 预检
    if (method === 'OPTIONS') {
      return corsPreflight(env);
    }

    try {
      // ── 网关：豆包技能简报推送（通道 2）──────────────────────────────
      if (path === '/api/push' && method === 'POST') {
        if (!checkAuth(request, env.PUSH_GATEWAY_TOKEN)) {
          return json({ error: 'unauthorized' }, 401, env);
        }
        const body = await readJson(request);
        const text = String(body.text || '').trim();
        if (!text) return json({ error: 'text required' }, 400, env);
        const source = String(body.source || 'skill');
        try {
          const res = await sendGroupMessage(env, text);
          await logPush(env, source, decorate(env, text), 'sent');
          return json({ ok: true, qq: res.id }, 200, env);
        } catch (e) {
          await logPush(env, source, decorate(env, text), 'failed');
          console.error(`[push] 发送失败: ${e.message}`);
          return json({ error: 'qq send failed: ' + e.message }, 502, env);
        }
      }

      // ── 前端接口（通道 1）────────────────────────────────────────────
      if (path.startsWith('/api/')) {
        if (!checkAuth(request, env.FRONTEND_TOKEN)) {
          return json({ error: 'unauthorized' }, 401, env);
        }

        // 提醒列表
        if (path === '/api/reminders' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT * FROM reminders ORDER BY due_date ASC, id ASC`
          ).all();
          return json({ ok: true, data: results.map(withNextFire) }, 200, env);
        }

        // 新建提醒
        if (path === '/api/reminders' && method === 'POST') {
          const body = await readJson(request);
          const v = validateReminder(body);
          if (v.error) return json({ error: v.error }, 400, env);
          const d = v.value;
          const { results } = await env.DB.prepare(
            `INSERT INTO reminders (type, title, note, due_date, lead_days, frequency, enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
          )
            .bind(d.type, d.title, d.note, d.due_date, d.lead_days, d.frequency, d.enabled)
            .all();
          return json({ ok: true, data: withNextFire(results[0]) }, 200, env);
        }

        // 修改提醒（先读旧行合并，避免部分字段缺失写成 undefined）
        if (path.startsWith('/api/reminders/') && method === 'PUT') {
          const id = path.split('/')[3];
          if (!/^\d+$/.test(id)) return json({ error: 'bad id' }, 400, env);
          const body = await readJson(request);
          const existing = await env.DB.prepare(`SELECT * FROM reminders WHERE id=?`).bind(id).first();
          if (!existing) return json({ error: 'not found' }, 404, env);
          const v = validateReminder({ ...existing, ...body });
          if (v.error) return json({ error: v.error }, 400, env);
          const d = v.value;
          const { results } = await env.DB.prepare(
            `UPDATE reminders SET type=?, title=?, note=?, due_date=?, lead_days=?, frequency=?, enabled=?
             WHERE id=? RETURNING *`
          )
            .bind(d.type, d.title, d.note, d.due_date, d.lead_days, d.frequency, d.enabled, id)
            .all();
          if (!results.length) return json({ error: 'not found' }, 404, env);
          return json({ ok: true, data: withNextFire(results[0]) }, 200, env);
        }

        // 删除提醒
        if (path.startsWith('/api/reminders/') && method === 'DELETE') {
          const id = path.split('/')[3];
          if (!/^\d+$/.test(id)) return json({ error: 'bad id' }, 400, env);
          const res = await env.DB.prepare(`DELETE FROM reminders WHERE id=?`).bind(id).run();
          if (!res.meta.changes) return json({ error: 'not found' }, 404, env);
          return json({ ok: true }, 200, env);
        }

        // 推送记录
        if (path === '/api/push-log' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT id, source, substr(text,1,200) AS preview, status, sent_at
             FROM push_log ORDER BY id DESC LIMIT 50`
          ).all();
          return json({ ok: true, data: results }, 200, env);
        }

        return json({ error: 'not found' }, 404, env);
      }

      return json({ error: 'not found' }, 404, env);
    } catch (e) {
      console.error('[api] 异常:', e);
      return json({ error: 'internal: ' + e.message }, 500, env);
    }
  },
};

// ═══════════════════════════ 业务逻辑 ═══════════════════════════

/** 查询今天处于提醒窗口、且按频率尚未发送的提醒 */
async function listDueReminders(env, today) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM reminders WHERE enabled = 1`
  ).all();
  // 最近发送日期（用于 daily / weekly 去重）
  const ids = results.map((r) => r.id);
  const lastSent = new Map();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const { results: sent } = await env.DB.prepare(
      `SELECT reminder_id, MAX(fire_date) AS last_fire
       FROM sent_log WHERE reminder_id IN (${placeholders})
       GROUP BY reminder_id`
    )
      .bind(...ids)
      .all();
    for (const s of sent) lastSent.set(s.reminder_id, s.last_fire);
  }

  const due = [];
  for (const r of results) {
    const winStart = addDays(r.due_date, -r.lead_days);
    if (!(winStart <= today && today <= r.due_date)) continue; // 不在窗口期
    const last = lastSent.get(r.id);
    if (r.frequency === 'weekly') {
      // 每周频率：最近 7 天内发过则跳过
      const weekAgo = addDays(today, -6);
      if (last && last >= weekAgo) continue;
    } else if (r.frequency === 'monthly') {
      // 每月频率：最近 30 天内发过则跳过（对应技能任务 B「每月看签证政策」）
      const monthAgo = addDays(today, -29);
      if (last && last >= monthAgo) continue;
    } else {
      // 每天频率：今天发过则跳过
      if (last === today) continue;
    }
    due.push(r);
  }
  return due;
}

/** 组装「今日待办清单」消息文本（格式对齐规格书 §5） */
function buildDailyDigest(due, today) {
  const mmdd = (s) => String(s).slice(5); // 2026-11-15 → 11-15
  const lines = due.map((r) => {
    const daysLeft = diffDays(today, r.due_date);
    const countdown = daysLeft > 0 ? `（还剩 ${daysLeft} 天）` : '（今天截止）';
    const note = r.note ? ` → ${r.note}` : '';
    return `【${r.type}】${r.title} ${mmdd(r.due_date)}${countdown}${note}`;
  });
  const maxDay = Math.max(
    ...due.map((r) => diffDays(addDays(r.due_date, -r.lead_days), today) + 1)
  );
  return [
    `📋 今日申请待办 (${mmdd(today)})`,
    '',
    ...lines,
    '',
    `共 ${due.length} 项 · 提醒第 ${maxDay} 天`,
  ].join('\n');
}

/**
 * 出群消息统一前缀。前缀取自 env.MESSAGE_PREFIX（wrangler.toml [vars]），
 * 留空则原样返回；已带前缀的不重复加。
 * 所有出群消息都经此函数 —— 改一处即覆盖 cron 日报与网关推送两条通道。
 */
function decorate(env, text) {
  const p = String(env.MESSAGE_PREFIX || '').trim();
  if (!p) return text;
  const s = String(text);
  return s.startsWith(p) ? s : `${p}\n${s}`;
}

/**
 * 发送文本消息到 QQ 群（msg_type=0 纯文本）。
 * 官方口径（bot.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/api-use.html）：
 *   - 统一地址 https://api.sgroup.qq.com
 *   - 鉴权头 Authorization: "QQBot {ACCESS_TOKEN}"（注意是 QQBot 前缀，不是 Bearer）
 */
async function sendGroupMessage(env, rawText) {
  const text = decorate(env, rawText);
  const token = await getAccessToken(env);
  const resp = await fetch(
    `https://api.sgroup.qq.com/v2/groups/${env.QQ_GROUP_OPENID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `QQBot ${token}`,
      },
      body: JSON.stringify({ msg_type: 0, content: text }),
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`QQ ${resp.status}: ${body.slice(0, 300)}`);
  }
  return await resp.json();
}

/** 获取 QQ access_token（KV 缓存，过期前 5 分钟刷新） */
async function getAccessToken(env) {
  const cached = await env.QQ_TOKEN_KV.get('qq_access_token', { type: 'json' });
  if (cached && cached.token && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }
  const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: env.QQ_APP_ID, clientSecret: env.QQ_APP_SECRET }),
  });
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error('获取 QQ token 失败: ' + JSON.stringify(data).slice(0, 300));
  }
  const value = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
  };
  await env.QQ_TOKEN_KV.put('qq_access_token', JSON.stringify(value));
  return value.token;
}

/** 写推送日志 */
async function logPush(env, source, text, status) {
  try {
    await env.DB.prepare(
      `INSERT INTO push_log (source, text, status) VALUES (?, ?, ?)`
    )
      .bind(source, text, status)
      .run();
  } catch (e) {
    console.error('[logPush] 写入失败:', e.message);
  }
}

/** 前端展示辅助：算「下次提醒日」 */
function withNextFire(r) {
  const winStart = addDays(r.due_date, -r.lead_days);
  const today = todayCn();
  let nextFire;
  if (today > r.due_date) nextFire = null;            // 已结束
  else if (today < winStart) nextFire = winStart;      // 尚未进入窗口
  else nextFire = today;                               // 窗口期内
  return { ...r, win_start: winStart, next_fire: nextFire };
}

// ═══════════════════════════ 校验与工具 ═══════════════════════════

/**
 * 校验并归一化提醒入参。
 * 契约：成功返回 { value: <归一化行> }，失败返回 { error: '<原因>' }。
 * （旧实现成功时也返回对象，导致调用方 `if (err)` 永远判真、POST/PUT 恒 400。）
 */
function validateReminder(b) {
  const out = {};
  out.type = String(b.type ?? '通用').slice(0, 20) || '通用';
  out.title = String(b.title ?? '').trim();
  if (!out.title) return { error: 'title 必填' };
  if (out.title.length > 120) return { error: 'title 过长' };
  out.note = String(b.note ?? '').slice(0, 300);
  out.due_date = String(b.due_date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.due_date) || Number.isNaN(Date.parse(out.due_date)))
    return { error: 'due_date 需为 YYYY-MM-DD' };
  out.lead_days = Number(b.lead_days ?? 0);
  if (!Number.isInteger(out.lead_days) || out.lead_days < 0 || out.lead_days > 365)
    return { error: 'lead_days 需为 0-365 的整数' };
  out.frequency = String(b.frequency ?? 'daily');
  if (!['daily', 'weekly', 'monthly'].includes(out.frequency))
    return { error: 'frequency 仅支持 daily/weekly/monthly' };
  out.enabled = b.enabled ? 1 : 0;
  return { value: out };
}

function checkAuth(request, expected) {
  if (!expected) return false;
  const h = request.headers.get('Authorization') || '';
  return h === `Bearer ${expected}`;
}

function corsPreflight(env) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env, true),
  });
}

function corsHeaders(env, preflight = false) {
  const allow =
    (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean) || ['*'];
  const origin = preflight ? (allow.includes('*') ? '*' : allow[0]) : allow.includes('*') ? '*' : allow[0];
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  return headers;
}

function json(obj, status = 200, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    throw new Error('请求体不是合法 JSON');
  }
}

/** 北京时间（UTC+8）今天的 YYYY-MM-DD */
function todayCn() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/** dateStr ± n 天 → YYYY-MM-DD（参数需为 YYYY-MM-DD） */
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 两个 YYYY-MM-DD 相差天数（b - a） */
function diffDays(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
