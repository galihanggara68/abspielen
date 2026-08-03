import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { computeGaps } from '../gapfill.js';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES } from '../taxonomy.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf-8'));
}

describe('computeGaps', () => {
  const cards = loadFixture('enriched.sample.json'); // 4 cards
  const snapshot = JSON.parse(JSON.stringify(cards));
  const { totals, gaps } = computeGaps(cards);

  it('reports correct totals', () => {
    expect(totals.cards).toBe(4);
    expect(totals.byLevel).toEqual({ A1: 3, A2: 1, B1: 0, B2: 0 });
  });

  it('does NOT mutate the input cards', () => {
    expect(cards).toEqual(snapshot);
  });

  it('emits a tag-min gap for every under-filled tag (deficit = 8 - count)', () => {
    const tagGaps = gaps.filter(g => g.reason === 'tag-min');
    // Every tag has < 8 cards in this 4-card fixture, so every tag gets a gap.
    expect(tagGaps).toHaveLength(VALID_TAGS.length);
    const social = tagGaps.find(g => g.tag === 'social-routines');
    expect(social.deficit).toBe(8 - 2); // 2 cards use social-routines
  });

  it('emits a type-per-level gap for under-filled cells', () => {
    const typeGaps = gaps.filter(g => g.reason === 'type-per-level');
    // Only A1/statement has >= 2; everything else is deficient.
    // Levels: A1 has 3 statements, A2 has 1 question, B1/B2 have 0.
    const a1Statement = typeGaps.find(g => g.cefr === 'A1' && g.sentenceType === 'statement');
    expect(a1Statement).toBeUndefined(); // already has 3 (>= 2)
    const b2command = typeGaps.find(g => g.cefr === 'B2' && g.sentenceType === 'command');
    expect(b2command.deficit).toBe(2);
  });

  it('emits a level-min gap for under-filled CEFR levels', () => {
    const levelGaps = gaps.filter(g => g.reason === 'level-min');
    expect(levelGaps.map(g => g.cefr).sort()).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(levelGaps.find(g => g.cefr === 'A1').deficit).toBe(85 - 3);
    expect(levelGaps.find(g => g.cefr === 'B2').deficit).toBe(85);
  });

  it('every gap carries a suggested cell', () => {
    for (const g of gaps) {
      expect(g.suggested).toBeDefined();
      if (g.reason === 'tag-min') {
        expect(VALID_CEFR).toContain(g.suggested.cefr);
        expect(VALID_SENTENCE_TYPES).toContain(g.suggested.sentenceType);
      } else if (g.reason === 'type-per-level') {
        expect(VALID_TAGS).toContain(g.suggested.tag);
      } else {
        expect(VALID_TAGS).toContain(g.suggested.tag);
        expect(VALID_SENTENCE_TYPES).toContain(g.suggested.sentenceType);
      }
    }
  });

  it('handles an empty corpus without throwing', () => {
    const { totals, gaps } = computeGaps([]);
    expect(totals.cards).toBe(0);
    expect(gaps.length).toBeGreaterThan(0);
  });
});
