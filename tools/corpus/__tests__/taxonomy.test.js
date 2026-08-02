import { describe, it, expect } from 'vitest';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES } from '../taxonomy.js';

describe('Taxonomy integrity', () => {
  it('VALID_TAGS has exactly 25 entries', () => {
    expect(VALID_TAGS).toHaveLength(25);
  });

  it('VALID_TAGS is frozen', () => {
    expect(Object.isFrozen(VALID_TAGS)).toBe(true);
    expect(() => {
      VALID_TAGS.push('invalid');
    }).toThrow();
  });

  it('VALID_CEFR has 4 levels', () => {
    expect(VALID_CEFR).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('VALID_SENTENCE_TYPES has 4 types', () => {
    expect(VALID_SENTENCE_TYPES).toEqual(['statement', 'question', 'command', 'subordinate']);
  });
});
