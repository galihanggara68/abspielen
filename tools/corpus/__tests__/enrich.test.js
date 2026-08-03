import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { joinEnrichment, readJsonl } from '../enrich.js';
import { validateCard } from '../validate.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf-8'));
}

describe('joinEnrichment (raw + skill JSONL → cards)', () => {
  const raw = loadFixture('raw.sample.json');
  const enrichment = readJsonl(path.join(fixturesDir, 'enrichment.sample.jsonl'));

  const { cards, skipped, rejected, orphans } = joinEnrichment(raw, enrichment);

  it('joins all raw items that have enrichment (4 of 5)', () => {
    expect(cards).toHaveLength(4);
    expect(skipped).toContain(5); // toebaId 5 has no enrichment line
    expect(skipped).toHaveLength(1);
  });

  it('assigns sequential ids starting at en-de-000001', () => {
    expect(cards.map(c => c.id)).toEqual([
      'en-de-000001', 'en-de-000002', 'en-de-000003', 'en-de-000004',
    ]);
  });

  it('assigns deterministic source/sourceRef/version, not from the skill', () => {
    for (const card of cards) {
      expect(card.source).toBe('tatoeba');
      expect(card.version).toBe(1);
    }
    expect(cards[0].sourceRef).toBe('tatoeba:1');
    expect(cards[3].sourceRef).toBe('tatoeba:4'); // raw item with toebaId 4
  });

  it('joins enrichment fields onto the card', () => {
    expect(cards[0].cefr).toBe('A1');
    expect(cards[0].tags).toEqual(['social-routines']);
    expect(cards[1].tags).toEqual(['daily-life', 'food']);
    expect(cards[3].sentenceType).toBe('question'); // toebaId 4
    expect(cards[2].tags).toEqual(['daily-life']);  // toebaId 3
  });

  it('flags orphan enrichment lines (toebaId with no raw match)', () => {
    expect(orphans.map(o => o.toebaId)).toEqual([999]);
  });

  it('produces cards that all pass validateCard', () => {
    for (const card of cards) {
      const { valid, errors } = validateCard(card);
      if (!valid) throw new Error(`Card ${card.id}: ${errors.join('; ')}`);
    }
  });

  it('reports rejected cards when enrichment is invalid', () => {
    const badRaw = [{ sourceText: 'Hi', targetText: 'Hallo', toebaId: 1 }];
    const badEnrichment = [{ toebaId: 1, cefr: 'X9', sentenceType: 'statement', tags: ['bogus'], ipa: '' }];
    const { cards: c, rejected: r } = joinEnrichment(badRaw, badEnrichment);
    expect(c).toHaveLength(0);
    expect(r).toHaveLength(1);
    expect(r[0].toebaId).toBe(1);
  });
});

describe('readJsonl', () => {
  it('skips blank lines and tolerates a malformed trailing line', () => {
    const tmp = path.join(fixturesDir, '__tmp.jsonl');
    fs.writeFileSync(tmp, '{"a":1}\n\n{"a":2}\n{not valid json\n');
    const out = readJsonl(tmp);
    fs.unlinkSync(tmp);
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

describe('enriched/en-de.json schema (integration, post-pipeline)', () => {
  it('all enriched cards pass schema validation', () => {
    const p = path.resolve(__dirname, '../enriched/en-de.json');
    if (!fs.existsSync(p)) return;
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (data.length === 0) return; // pipeline not run yet
    for (const card of data) {
      const { valid, errors } = validateCard(card);
      if (!valid) throw new Error(`Card ${card.id}: ${errors.join('; ')}`);
    }
  });
});
