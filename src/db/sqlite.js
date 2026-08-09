import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { SqlJsPlugin } from './sqljs.js';

let _plugin = Capacitor.getPlatform() === 'web' ? SqlJsPlugin : CapacitorSQLite;
const _db = 'abspielen';

export function _setPlugin(plugin) {
  _plugin = plugin;
}

async function _execute(sql) {
  return _plugin.execute({ database: _db, statements: sql, transaction: false });
}

async function _run(sql, values) {
  return _plugin.run({ database: _db, statement: sql, values: values || [], transaction: false });
}

async function _query(sql, values) {
  const result = await _plugin.query({ database: _db, statement: sql, values: values || [] });
  return result.values || [];
}

export async function initDb() {
  await _plugin.createConnection({ database: _db, version: 1, encrypted: false, mode: 'no-encryption' });
  await _plugin.open({ database: _db });

  const tables = `
    CREATE TABLE IF NOT EXISTS card_state(
      card_id TEXT PRIMARY KEY,
      ease REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER,
      last_reviewed_at INTEGER,
      state TEXT NOT NULL DEFAULT 'new'
    );
    CREATE TABLE IF NOT EXISTS review_log(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      grade TEXT NOT NULL,
      prev_ease REAL,
      prev_interval INTEGER,
      prev_reps INTEGER,
      new_ease REAL,
      new_interval INTEGER,
      new_reps INTEGER,
      note TEXT,
      session_id TEXT
    );
    CREATE TABLE IF NOT EXISTS session_state(
      id INTEGER PRIMARY KEY,
      active_strategy TEXT,
      current_run_key TEXT,
      current_run_count INTEGER NOT NULL DEFAULT 0,
      cards_seen_today INTEGER NOT NULL DEFAULT 0,
      new_cards_today INTEGER NOT NULL DEFAULT 0,
      day_start_ts INTEGER,
      current_session_id TEXT,
      current_streak INTEGER NOT NULL DEFAULT 0,
      last_study_date TEXT
    );
    CREATE TABLE IF NOT EXISTS prefs(
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;
  await _execute(tables);

  await _run('INSERT OR IGNORE INTO session_state(id, current_run_count, cards_seen_today, new_cards_today) VALUES(1, 0, 0, 0)');
  await _run("INSERT OR IGNORE INTO prefs(key, value) VALUES('schema_version', '1')");
}

export async function getCardState(cardId) {
  const rows = await _query('SELECT * FROM card_state WHERE card_id = ?', [cardId]);
  return rows.length > 0 ? rows[0] : null;
}

export async function upsertCardState(cardState) {
  await _run(
    'INSERT OR REPLACE INTO card_state(card_id, ease, interval_days, repetitions, due_at, last_reviewed_at, state) VALUES(?,?,?,?,?,?,?)',
    [
      cardState.card_id,
      cardState.ease,
      cardState.interval_days,
      cardState.repetitions,
      cardState.due_at,
      cardState.last_reviewed_at,
      cardState.state
    ]
  );
}

export async function getDueCards(now, limit) {
  return _query(
    "SELECT * FROM card_state WHERE due_at <= ? ORDER BY due_at ASC LIMIT ?",
    [now, limit]
  );
}

export async function getNewCards(limit) {
  return _query("SELECT * FROM card_state WHERE state = 'new' LIMIT ?", [limit]);
}

export async function insertReviewLog(entry) {
  await _run(
    'INSERT INTO review_log(card_id, reviewed_at, grade, prev_ease, prev_interval, prev_reps, new_ease, new_interval, new_reps, session_id, note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [
      entry.card_id,
      entry.reviewed_at,
      entry.grade,
      entry.prev_ease,
      entry.prev_interval,
      entry.prev_reps,
      entry.new_ease,
      entry.new_interval,
      entry.new_reps,
      entry.session_id !== undefined ? entry.session_id : null,
      entry.note !== undefined ? entry.note : null
    ]
  );
}

export async function getReviewLogs(since) {
  return _query('SELECT * FROM review_log WHERE reviewed_at >= ? ORDER BY reviewed_at ASC', [since]);
}

export async function getReviewLogsForCard(cardId, since) {
  return _query('SELECT * FROM review_log WHERE card_id = ? AND reviewed_at >= ? ORDER BY reviewed_at ASC', [cardId, since]);
}

export async function getReviewLogsBySession(sessionId) {
  return _query('SELECT * FROM review_log WHERE session_id = ? ORDER BY reviewed_at ASC', [sessionId]);
}

export async function getSessionState() {
  const rows = await _query('SELECT * FROM session_state WHERE id = 1');
  return rows.length > 0 ? rows[0] : null;
}

export async function updateSessionState(partial) {
  const keys = Object.keys(partial).filter(k => k !== 'id');
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => partial[k]);
  await _run(`UPDATE session_state SET ${setClause} WHERE id = 1`, values);
}

export async function getPref(key) {
  const rows = await _query('SELECT value FROM prefs WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setPref(key, value) {
  await _run('INSERT OR REPLACE INTO prefs(key, value) VALUES(?,?)', [key, value]);
}

export async function seedNewCards(cardIds) {
  if (!cardIds || cardIds.length === 0) return;
  const stmts = cardIds.map(id => ({
    statement: "INSERT OR IGNORE INTO card_state(card_id, state) VALUES(?, 'new')",
    values: [id]
  }));
  await _plugin.executeSet({ database: _db, set: stmts, transaction: true });
}

export async function countCardsByState(state) {
  const rows = await _query('SELECT COUNT(*) as count FROM card_state WHERE state = ?', [state]);
  return rows.length > 0 ? rows[0].count : 0;
}

export async function countDueCards(now) {
  const rows = await _query('SELECT COUNT(*) as count FROM card_state WHERE due_at <= ?', [now]);
  return rows.length > 0 ? rows[0].count : 0;
}

export async function resetAllProgress() {
  await _execute('DELETE FROM card_state; DELETE FROM review_log;');
  await _run('UPDATE session_state SET active_strategy = NULL, current_run_key = NULL, current_run_count = 0, cards_seen_today = 0, new_cards_today = 0, day_start_ts = NULL, current_session_id = NULL WHERE id = 1');
}
