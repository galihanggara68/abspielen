import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VALID_TAGS, VALID_CEFR } from '../taxonomy.js';

// Whole-pipeline coverage properties. These run only against a fully-merged
// enriched/en-de.json (i.e. after /corpus-enrich → enrich → gaps → /corpus-gapfill → merge).
// They skip when the pipeline hasn't produced data yet (file missing or empty).
const inPath = path.resolve(__dirname, '../enriched/en-de.json');

function loadIfPopulated() {
  if (!fs.existsSync(inPath)) return null;
  const data = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  if (!Array.isArray(data) || data.length === 0) return null;
  return data;
}

describe('Corpus coverage (integration — post-pipeline only)', () => {
  const data = loadIfPopulated();
  const reason = data ? '' : 'skipped: enriched/en-de.json not populated (run the full pipeline)';

  it('every tag has >= 8 cards', () => {
    if (!data) return console.warn(reason);
    const tagCounts = {};
    VALID_TAGS.forEach(t => (tagCounts[t] = 0));
    data.forEach(card => card.tags.forEach(t => tagCounts[t]++));
    for (const [tag, count] of Object.entries(tagCounts)) {
      expect(count, `tag "${tag}"`).toBeGreaterThanOrEqual(8);
    }
  });

  it('each CEFR level has 80-120 cards', () => {
    if (!data) return console.warn(reason);
    const levelCounts = { A1: 0, A2: 0, B1: 0, B2: 0 };
    data.forEach(card => levelCounts[card.cefr]++);
    for (const [level, count] of Object.entries(levelCounts)) {
      expect(count, `level ${level}`).toBeGreaterThanOrEqual(80);
      expect(count, `level ${level}`).toBeLessThanOrEqual(120);
    }
  });

  it('every sentenceType per level has >= 2 cards', () => {
    if (!data) return console.warn(reason);
    const typeByLevel = {};
    VALID_CEFR.forEach(c => (typeByLevel[c] = { statement: 0, question: 0, command: 0, subordinate: 0 }));
    data.forEach(card => { if (typeByLevel[card.cefr]) typeByLevel[card.cefr][card.sentenceType]++; });
    for (const [level, types] of Object.entries(typeByLevel)) {
      for (const [type, count] of Object.entries(types)) {
        expect(count, `${level}/${type}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
