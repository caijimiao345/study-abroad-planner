-- QQ 留学提醒系统 · D1 数据库结构
-- 执行：wrangler d1 execute qq-reminder --local --file=schema.sql   （本地）
--       wrangler d1 execute qq-reminder --remote --file=schema.sql  （生产）

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT '通用',        -- 类型：申请 / 签证 / 语言 / 通用（可自定义）
  title TEXT NOT NULL,                      -- 标题，如「Potsdam 申请截止」
  note TEXT DEFAULT '',                     -- 补充说明 / 动作建议
  due_date TEXT NOT NULL,                   -- 目标日期 YYYY-MM-DD
  lead_days INTEGER NOT NULL DEFAULT 0,     -- 提前 N 天进入提醒窗口
  frequency TEXT NOT NULL DEFAULT 'daily',  -- 窗口内频率：daily / weekly
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reminder_id INTEGER NOT NULL,
  fire_date TEXT NOT NULL,                  -- 实际发送日期 YYYY-MM-DD
  UNIQUE(reminder_id, fire_date)            -- 防同日重复发送（cron 补跑也安全）
);

CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT DEFAULT 'skill',              -- skill（豆包简报）/ cron（定时清单）/ manual
  text TEXT NOT NULL,
  status TEXT,                              -- sent / failed
  sent_at TEXT DEFAULT (datetime('now'))
);
