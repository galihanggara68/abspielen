import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { computeStats } from '../src/domain/stats.js';
import { _setPlugin, initDb, insertReviewLog } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import "fake-indexeddb/auto";

describe('Stats Component', () => {
  let mockPlugin;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('T-06-4: 7-day retention rate calculation', async () => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // 6 good, 2 easy, 2 again = 80% retention
    for (let i = 0; i < 6; i++) {
      await insertReviewLog({ card_id: `c${i}`, reviewed_at: sevenDaysAgo + i * 1000, grade: 'good', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.6, new_interval: 1, new_reps: 1 });
    }
    for (let i = 6; i < 8; i++) {
      await insertReviewLog({ card_id: `c${i}`, reviewed_at: sevenDaysAgo + i * 1000, grade: 'easy', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.7, new_interval: 1, new_reps: 1 });
    }
    for (let i = 8; i < 10; i++) {
      await insertReviewLog({ card_id: `c${i}`, reviewed_at: sevenDaysAgo + i * 1000, grade: 'again', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.3, new_interval: 1, new_reps: 0 });
    }

    const stats = await computeStats(now);
    expect(stats.retentionRate).toBe(80);
  });
});
