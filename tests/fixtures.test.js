import { describe, test, expect } from 'vitest';
import fixtures from '../src/data/fixtures.json';

const VALID_TAGS = [
  'daily-life','food','travel','shopping','work','study','health','money',
  'leisure','nature','technology','time','relationships','culture','emotions',
  'describing','narrating','asking-info','requesting','advising','opining',
  'apologizing','social-routines','inviting','planning'
];

describe('Fixtures Validation', () => {
  test('fixtures.json has the correct envelope', () => {
    expect(fixtures.id).toBe('fixtures-dev-001');
    expect(fixtures.pair).toBe('en-de');
    expect(fixtures.level).toBe('mixed');
  });

  test('contains exactly 10 valid cards spanning all 4 CEFR levels', () => {
    const cards = fixtures.cards;
    expect(cards).toHaveLength(10);

    const levels = new Set();
    const types = new Set();

    for (const card of cards) {
      expect(card.id).toMatch(/^en-de-/);
      expect(['A1','A2','B1','B2']).toContain(card.cefr);
      expect(['statement','question','command','subordinate']).toContain(card.sentenceType);
      expect(card.tags.length).toBeGreaterThanOrEqual(1);
      expect(card.tags.length).toBeLessThanOrEqual(3);
      card.tags.forEach(t => expect(VALID_TAGS).toContain(t));
      expect(card.ipa).toBeTruthy();
      expect(card.altTargets.length).toBeGreaterThanOrEqual(1);
      expect(card.pair).toBe('en-de');
      expect(card.source).toBeTruthy();
      expect(card.version).toBe(1);
      levels.add(card.cefr);
      types.add(card.sentenceType);
    }
    expect(levels.size).toBe(4);
    expect(types.size).toBe(4);
  });

  test('uses only valid tags from the 25-tag taxonomy', () => {
    const allTags = fixtures.cards.flatMap(c => c.tags);
    const uniqueTags = [...new Set(allTags)];
    expect(uniqueTags.length).toBeGreaterThanOrEqual(6);
    uniqueTags.forEach(t => expect(VALID_TAGS).toContain(t));
  });

  test('CEFR level distribution matches requirements', () => {
    const dist = {};
    fixtures.cards.forEach(c => { dist[c.cefr] = (dist[c.cefr] || 0) + 1; });
    expect(dist.A1).toBe(3);
    expect(dist.A2).toBe(3);
    expect(dist.B1).toBe(2);
    expect(dist.B2).toBe(2);
  });
});
