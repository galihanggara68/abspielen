import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { _setPlugin, initDb, getCardState, upsertCardState, getDueCards, getNewCards, insertReviewLog, getReviewLogs, getReviewLogsForCard, getSessionState, updateSessionState, getPref, setPref, seedNewCards, countCardsByState, resetAllProgress } from '../src/db/sqlite.js'
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js'

describe('SQLite Data Layer', () => {
  let mockPlugin;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('initDb creates all required tables', async () => {
    // Query sqlite_master for table names
    const result = await mockPlugin.query({ statement: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", values: [] });
    const names = result.values.map(t => t.name);
    expect(names).toContain('card_state');
    expect(names).toContain('review_log');
    expect(names).toContain('session_state');
    expect(names).toContain('prefs');
  });

  test('upsert and get card_state', async () => {
    const state = {
      card_id: 'en-de-000001', ease: 2.5, interval_days: 0,
      repetitions: 0, due_at: null, last_reviewed_at: null, state: 'new'
    };
    await upsertCardState(state);
    const result = await getCardState('en-de-000001');
    expect(result).toMatchObject(state);
  });

  test('getDueCards returns due and new cards, ordered correctly', async () => {
    const now = Date.now();
    await upsertCardState({ card_id: 'c1', due_at: now - 1000, state: 'review', ease: 2.5, interval_days: 1, repetitions: 1, last_reviewed_at: null });
    await upsertCardState({ card_id: 'c2', due_at: now + 99999, state: 'review', ease: 2.5, interval_days: 1, repetitions: 1, last_reviewed_at: null }); // not due
    await upsertCardState({ card_id: 'c3', due_at: null, state: 'new', ease: 2.5, interval_days: 0, repetitions: 0, last_reviewed_at: null });
    await upsertCardState({ card_id: 'c4', due_at: now - 5000, state: 'review', ease: 2.5, interval_days: 1, repetitions: 1, last_reviewed_at: null });

    const due = await getDueCards(now, 10);
    const ids = due.map(c => c.card_id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
    expect(ids).toContain('c4');
    expect(ids).not.toContain('c2');
    // c3 (null due_at = new) should come first, then c4 (most overdue), then c1
    expect(ids.indexOf('c3')).toBeLessThan(ids.indexOf('c4'));
    expect(ids.indexOf('c4')).toBeLessThan(ids.indexOf('c1'));
  });

  test('insertReviewLog and getReviewLogs', async () => {
    const entries = [
      { card_id: 'c1', reviewed_at: 1000, grade: 'good', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.6, new_interval: 1, new_reps: 1 },
      { card_id: 'c1', reviewed_at: 2000, grade: 'easy', prev_ease: 2.6, prev_interval: 1, prev_reps: 1, new_ease: 2.7, new_interval: 3, new_reps: 2 },
      { card_id: 'c2', reviewed_at: 3000, grade: 'hard', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.3, new_interval: 1, new_reps: 1 },
    ];
    for (const e of entries) await insertReviewLog(e);
    const logs = await getReviewLogs(0);
    expect(logs).toHaveLength(3);
    expect(logs[0]).toMatchObject(entries[0]);
    expect(logs[1]).toMatchObject(entries[1]);
    expect(logs[2]).toMatchObject(entries[2]);
  });

  test('getReviewLogsForCard filters by card_id and since', async () => {
    await insertReviewLog({ card_id: 'c1', reviewed_at: 1000, grade: 'good', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.6, new_interval: 1, new_reps: 1 });
    await insertReviewLog({ card_id: 'c2', reviewed_at: 2000, grade: 'hard', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.3, new_interval: 1, new_reps: 1 });
    await insertReviewLog({ card_id: 'c1', reviewed_at: 3000, grade: 'easy', prev_ease: 2.6, prev_interval: 1, prev_reps: 1, new_ease: 2.7, new_interval: 3, new_reps: 2 });

    const logs = await getReviewLogsForCard('c1', 0);
    expect(logs).toHaveLength(2);
    expect(logs.every(l => l.card_id === 'c1')).toBe(true);

    const logsSince2000 = await getReviewLogsForCard('c1', 2000);
    expect(logsSince2000).toHaveLength(1);
    expect(logsSince2000[0].reviewed_at).toBe(3000);
  });

  test('session_state initializes with defaults and supports partial update', async () => {
    let ss = await getSessionState();
    expect(ss.id).toBe(1);
    expect(ss.active_strategy).toBeNull();
    expect(ss.cards_seen_today).toBe(0);
    expect(ss.current_run_count).toBe(0);

    await updateSessionState({ active_strategy: 'tag-run', cards_seen_today: 5 });
    ss = await getSessionState();
    expect(ss.active_strategy).toBe('tag-run');
    expect(ss.cards_seen_today).toBe(5);
    expect(ss.current_run_count).toBe(0); // unchanged
  });

  test('setPref and getPref', async () => {
    await setPref('daily_new_limit', '20');
    expect(await getPref('daily_new_limit')).toBe('20');
    await setPref('daily_new_limit', '30');
    expect(await getPref('daily_new_limit')).toBe('30');
    expect(await getPref('nonexistent')).toBeNull();
  });

  test('seedNewCards is idempotent for existing cards', async () => {
    await seedNewCards(['c1', 'c2']);
    // Simulate grading c1
    await upsertCardState({ card_id: 'c1', ease: 2.8, interval_days: 1, repetitions: 1, due_at: 99999, last_reviewed_at: null, state: 'review' });
    // Re-seed with overlap
    await seedNewCards(['c2', 'c3']);
    const c1 = await getCardState('c1');
    expect(c1.state).toBe('review'); // not overwritten
    expect(c1.ease).toBe(2.8);
    const c3 = await getCardState('c3');
    expect(c3.state).toBe('new');
  });

  test('countCardsByState returns accurate count', async () => {
    await seedNewCards(['c1', 'c2', 'c3']);
    await upsertCardState({ card_id: 'c1', ease: 2.5, interval_days: 1, repetitions: 1, due_at: 1000, last_reviewed_at: 500, state: 'review' });
    expect(await countCardsByState('new')).toBe(2);
    expect(await countCardsByState('review')).toBe(1);
    expect(await countCardsByState('learning')).toBe(0);
  });

  test('resetAllProgress clears data and resets counters', async () => {
    await seedNewCards(['c1', 'c2']);
    await insertReviewLog({ card_id: 'c1', reviewed_at: 1000, grade: 'good', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.6, new_interval: 1, new_reps: 1 });
    await updateSessionState({ cards_seen_today: 10, active_strategy: 'tag-run' });

    await resetAllProgress();

    expect(await countCardsByState('new')).toBe(0);
    const logs = await getReviewLogs(0);
    expect(logs).toHaveLength(0);
    const ss = await getSessionState();
    expect(ss.cards_seen_today).toBe(0);
    expect(ss.active_strategy).toBeNull();
  });

  test('getNewCards returns only new cards', async () => {
    await seedNewCards(['c1', 'c2', 'c3']);
    await upsertCardState({ card_id: 'c1', ease: 2.5, interval_days: 1, repetitions: 1, due_at: 1000, last_reviewed_at: null, state: 'review' });
    const newCards = await getNewCards(10);
    expect(newCards).toHaveLength(2);
    expect(newCards.map(c => c.card_id).sort()).toEqual(['c2', 'c3']);
  });

  test('schema_version pref is set to 1', async () => {
    expect(await getPref('schema_version')).toBe('1');
  });
});
