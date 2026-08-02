import { describe, it, expect, beforeEach } from 'vitest';
import { applyStrategy, resetRun } from '../src/domain/strategies.js';

describe('strategies', () => {
  describe('pure-srs', () => {
    it('most overdue first', () => {
      const cards = [
        { id: 'c1', due_at: 3000, state: 'learning' },
        { id: 'c2', due_at: 1000, state: 'learning' },
        { id: 'c3', due_at: 2000, state: 'learning' },
      ];
      const session = { active_strategy: 'pure-srs', current_run_key: null, current_run_count: 0, cards_seen_today: 0 };
      const result = applyStrategy(cards, session, {});
      expect(result.card.id).toBe('c2');
    });

    it('interleaves new cards at 1:3 ratio', () => {
      const cards = [
        { id: 'new1', state: 'new' },
        { id: 'c1', due_at: 1000, state: 'learning' }
      ];
      // 0, 1, 2 should be reviews. 3 should be new.
      const session0 = { active_strategy: 'pure-srs', cards_seen_today: 0 };
      expect(applyStrategy(cards, session0, {}).card.id).toBe('c1');
      
      const session3 = { active_strategy: 'pure-srs', cards_seen_today: 3 };
      expect(applyStrategy(cards, session3, {}).card.id).toBe('new1');
    });

    it('returns null when no cards available', () => {
      const result = applyStrategy([], {}, {});
      expect(result.card).toBeNull();
    });
  });

  describe('tag-run', () => {
    it('5 consecutive cards with same tag', () => {
      const cards = Array.from({ length: 8 }, (_, i) => ({
        id: `c${i}`, tags: ['travel', 'food'], sentenceType: 'statement', due_at: 1000 + i, state: 'learning'
      }));
      const session = { active_strategy: 'tag-run', current_run_key: null, current_run_count: 0 };

      let lastKey = null;
      for (let i = 0; i < 5; i++) {
        const result = applyStrategy(cards, session, {});
        if (i === 0) lastKey = result.newRunKey || session.current_run_key;
        session.current_run_key = result.newRunKey || session.current_run_key;
        session.current_run_count = result.newRunCount;
        expect(session.current_run_key).toBe(lastKey);
      }
      expect(session.current_run_count).toBe(5);
    });

    it('switches tag after 5 cards', () => {
      const cards = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`, tags: i < 5 ? ['travel'] : ['food'], due_at: 1000 + i, state: 'learning'
      }));
      const session = { active_strategy: 'tag-run', current_run_key: 'travel', current_run_count: 5 };
      const result = applyStrategy(cards, session, {});
      expect(result.newRunKey).not.toBe('travel');
      expect(result.newRunCount).toBe(1);
    });

    it('switches early when < 5 cards share tag', () => {
      const cards = [
        { id: 'c1', tags: ['travel'], due_at: 1000, state: 'learning' },
        { id: 'c2', tags: ['food'], due_at: 2000, state: 'learning' },
      ];
      const session = { active_strategy: 'tag-run', current_run_key: 'travel', current_run_count: 0 };
      
      let result = applyStrategy(cards, session, {});
      expect(result.card.id).toBe('c1');
      
      session.current_run_key = result.newRunKey || session.current_run_key;
      session.current_run_count = result.newRunCount;
      
      result = applyStrategy([cards[1]], session, {});
      expect(result.card.id).toBe('c2');
      expect(result.newRunKey).toBe('food');
    });

    it('falls back when no tag matches', () => {
      const cards = [{ id: 'c1', tags: ['travel'], due_at: 1000, state: 'learning' }];
      const session = { active_strategy: 'tag-run', current_run_key: 'nonexistent', current_run_count: 1 };
      const result = applyStrategy(cards, session, {});
      // should switch tag to 'travel'
      expect(result.card.id).toBe('c1');
      expect(result.newRunKey).toBe('travel');
    });

    it('falls back to pure-srs if no tags on any card', () => {
      const cards = [{ id: 'c1', due_at: 1000, state: 'learning' }];
      const session = { active_strategy: 'tag-run', current_run_key: 'nonexistent', current_run_count: 1 };
      const result = applyStrategy(cards, session, {});
      expect(result.card.id).toBe('c1');
      expect(result.newRunKey).toBeNull();
    });
  });

  describe('type-run', () => {
    it('cap of 2', () => {
      const cards = [
        { id: 'c1', sentenceType: 'question', tags: ['travel'], due_at: 1000, state: 'learning' },
        { id: 'c2', sentenceType: 'question', tags: ['food'], due_at: 2000, state: 'learning' },
        { id: 'c3', sentenceType: 'statement', tags: ['travel'], due_at: 3000, state: 'learning' },
      ];
      const session = { active_strategy: 'type-run', current_run_key: 'question', current_run_count: 2 };
      const result = applyStrategy(cards, session, {});
      expect(result.newRunKey).not.toBe('question');
    });
  });

  describe('difficulty-injection', () => {
    it('5 at level then 1 harder', () => {
      const cards = [
        ...Array.from({ length: 5 }, (_, i) => ({ id: `b1-${i}`, cefr: 'B1', tags: ['travel'], due_at: 1000 + i, state: 'learning' })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `b2-${i}`, cefr: 'B2', tags: ['food'], due_at: 2000 + i, state: 'learning' })),
      ];
      const session = { active_strategy: 'difficulty-injection', current_run_key: 'B1', current_run_count: 4 };
      
      let result = applyStrategy(cards, session, { currentLevel: 'B1', recentFailedCardIds: [] });
      expect(result.card.cefr).toBe('B1');
      
      session.current_run_count = 5;
      result = applyStrategy(cards, session, { currentLevel: 'B1', recentFailedCardIds: [] });
      expect(result.card.cefr).toBe('B2');
    });

    it('B2 user gets failed card as spike', () => {
      const failedCard = { id: 'failed-1', cefr: 'B2', tags: ['health'], due_at: 1000, state: 'learning' };
      const normalCard = { id: 'normal-1', cefr: 'B2', tags: ['travel'], due_at: 2000, state: 'learning' };
      const cards = [normalCard, failedCard];
      const session = { active_strategy: 'difficulty-injection', current_run_key: 'B2', current_run_count: 5 };
      const result = applyStrategy(cards, session, { currentLevel: 'B2', recentFailedCardIds: ['failed-1'] });
      expect(result.card.id).toBe('failed-1');
    });
  });

  describe('resetRun', () => {
    it('resets run state', () => {
      const session = { active_strategy: 'tag-run', current_run_key: 'travel', current_run_count: 3 };
      const reset = resetRun(session);
      expect(reset.current_run_key).toBeNull();
      expect(reset.current_run_count).toBe(0);
    });
  });
});
