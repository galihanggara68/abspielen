import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { getNextCard, gradeCard } from '../src/domain/scheduler.js';
import { _setPlugin, initDb, upsertCardState, getCardState, getReviewLogs, seedNewCards } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';

describe('Scheduler', () => {
  let mockPlugin;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('getNextCard returns most overdue card', async () => {
    const now = Date.now();
    // Seed: c1 due 5s ago, c2 due 1s ago
    await upsertCardState({ card_id: 'c1', due_at: now - 5000, state: 'review', ease: 2.5, interval_days: 1, repetitions: 1, last_reviewed_at: null });
    await upsertCardState({ card_id: 'c2', due_at: now - 1000, state: 'review', ease: 2.5, interval_days: 1, repetitions: 1, last_reviewed_at: null });
    const card = await getNextCard({ now, newCardLimit: 20, newCardsToday: 0 });
    expect(card.id).toBe('c1');
  });

  test('getNextCard interleaves 1 new per 3 reviews', async () => {
    const now = Date.now();
    // 3 due reviews + 3 new cards
    for (let i = 0; i < 3; i++) {
      await upsertCardState({ card_id: `r${i}`, due_at: now - 1000 * (3-i), state: 'review', ease: 2.5, interval_days: 1, repetitions: 1, last_reviewed_at: null });
      await upsertCardState({ card_id: `n${i}`, due_at: null, state: 'new', ease: 2.5, interval_days: 0, repetitions: 0, last_reviewed_at: null });
    }
    const pulled = [];
    for (let i = 0; i < 4; i++) {
      const card = await getNextCard({ now, newCardLimit: 20, newCardsToday: pulled.filter(c => c.startsWith('n')).length });
      pulled.push(card.id);
      await gradeCard(card.id, 'good'); // move out of queue
    }
    const newCount = pulled.filter(id => id.startsWith('n')).length;
    expect(newCount).toBe(1); // 1 new out of 4
  });

  test('getNextCard returns null when nothing to do', async () => {
    const card = await getNextCard({ now: Date.now(), newCardLimit: 0, newCardsToday: 0 });
    expect(card).toBeNull();
  });

  test('gradeCard creates review_log entry', async () => {
    await seedNewCards(['c1']);
    await gradeCard('c1', 'good');
    const logs = await getReviewLogs(0);
    expect(logs).toHaveLength(1);
    expect(logs[0].card_id).toBe('c1');
    expect(logs[0].grade).toBe('good');
    expect(logs[0].new_reps).toBe(1);
  });
});
