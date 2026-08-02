import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('fetch_tatoeba deduplication', () => {
  const outPath = path.resolve(__dirname, '../raw/tatoeba-en-de.json');

  it('fetch output has no duplicate targetText', () => {
    if (!fs.existsSync(outPath)) {
      console.warn('Skipping test: raw output not found');
      return;
    }
    const raw = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    const normalized = raw.map(e => e.targetText.toLowerCase().trim().replace(/\s+/g, ' '));
    const unique = new Set(normalized);
    expect(unique.size).toBe(normalized.length);
  });

  it('outputs a JSON file with >=200 deduplicated sentence pairs', () => {
    if (!fs.existsSync(outPath)) return;
    const raw = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(raw.length).toBeGreaterThanOrEqual(200);
  });

  it('each entry has non-empty sourceText and targetText', () => {
    if (!fs.existsSync(outPath)) return;
    const raw = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    for (const item of raw) {
      expect(typeof item.sourceText).toBe('string');
      expect(item.sourceText.trim().length).toBeGreaterThan(0);
      expect(typeof item.targetText).toBe('string');
      expect(item.targetText.trim().length).toBeGreaterThan(0);
    }
  });
});
