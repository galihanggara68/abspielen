import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES, VALID_SOURCES } from '../taxonomy.js';

function validateCard(card) {
  expect(card.id).toMatch(/^en-de-\d{6}$/);
  expect(card.pair).toBe('en-de');
  expect(card.sourceText).toBeTruthy();
  expect(card.targetText).toBeTruthy();
  expect(Array.isArray(card.altTargets)).toBe(true);
  expect(card.altTargets.length).toBeLessThanOrEqual(2);
  expect(VALID_CEFR).toContain(card.cefr);
  expect(VALID_SENTENCE_TYPES).toContain(card.sentenceType);
  expect(card.tags.length).toBeGreaterThanOrEqual(1);
  expect(card.tags.length).toBeLessThanOrEqual(3);
  card.tags.forEach(t => expect(VALID_TAGS).toContain(t));
  expect(card.ipa).toBeTruthy();
  expect(VALID_SOURCES).toContain(card.source);
  expect(card.version).toBeGreaterThanOrEqual(1);
}

describe('Card schema validation', () => {
  it('all enriched cards pass schema validation', () => {
    const p = path.resolve(__dirname, '../enriched/en-de.json');
    if (!fs.existsSync(p)) {
      console.warn('Skipping test: enriched output not found');
      return;
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    data.forEach(card => validateCard(card));
  });
});
