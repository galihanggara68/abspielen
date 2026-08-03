import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mergeGapfill } from '../merge_gapfill.js';
import { readJsonl } from '../enrich.js';
import { validateCard } from '../validate.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf-8'));
}

describe('mergeGapfill (skill JSONL → appended enriched cards)', () => {
  const existing = loadFixture('enriched.sample.json'); // ids 000001–000004
  const incoming = readJsonl(path.join(fixturesDir, 'gapfill-cards.sample.jsonl'));

  const { cards, merged, rejected } = mergeGapfill(existing, incoming);

  it('keeps the existing cards and appends valid gapfill cards', () => {
    expect(cards).toHaveLength(6); // 4 existing + 2 valid incoming
    expect(merged).toBe(2);
    expect(rejected).toHaveLength(1); // the invalid-tag card
  });

  it('continues ids from the max existing id', () => {
    expect(cards[4].id).toBe('en-de-000005');
    expect(cards[5].id).toBe('en-de-000006');
  });

  it('marks merged cards as source=ai with null sourceRef', () => {
    for (const card of cards.slice(4)) {
      expect(card.source).toBe('ai');
      expect(card.sourceRef).toBeNull();
      expect(card.version).toBe(1);
    }
  });

  it('carries skill content fields onto the merged cards', () => {
    expect(cards[4].tags).toEqual(['health']);
    expect(cards[4].cefr).toBe('A1');
    expect(cards[5].sentenceType).toBe('command');
  });

  it('produces cards that all pass validateCard', () => {
    for (const card of cards) {
      const { valid, errors } = validateCard(card);
      if (!valid) throw new Error(`Card ${card.id}: ${errors.join('; ')}`);
    }
  });

  it('does NOT mutate the existing cards array (returns a new one)', () => {
    expect(existing).toHaveLength(4); // untouched
  });

  it('continues ids correctly when existing cards have a gap', () => {
    const gapped = [
      { ...existing[0] },
      { ...existing[3], id: 'en-de-000010' },
    ];
    const { cards: c } = mergeGapfill(gapped, [incoming[0]]);
    expect(c[2].id).toBe('en-de-000011');
  });
});
