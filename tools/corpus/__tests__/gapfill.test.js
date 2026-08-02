import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VALID_TAGS, VALID_CEFR } from '../taxonomy.js';

describe('Gapfill coverage', () => {
  const inPath = path.resolve(__dirname, '../enriched/en-de.json');

  it('every tag has >= 8 cards', () => {
    if (!fs.existsSync(inPath)) return;
    const data = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
    const tagCounts = {};
    VALID_TAGS.forEach(t => tagCounts[t] = 0);
    data.forEach(card => card.tags.forEach(t => tagCounts[t]++));
    Object.entries(tagCounts).forEach(([tag, count]) => {
      expect(count).toBeGreaterThanOrEqual(8);
    });
  });

  it('each CEFR level has 80-120 cards', () => {
    if (!fs.existsSync(inPath)) return;
    const data = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
    const levelCounts = { A1: 0, A2: 0, B1: 0, B2: 0 };
    data.forEach(card => levelCounts[card.cefr]++);
    Object.entries(levelCounts).forEach(([level, count]) => {
      expect(count).toBeGreaterThanOrEqual(80);
      expect(count).toBeLessThanOrEqual(120);
    });
  });
});
