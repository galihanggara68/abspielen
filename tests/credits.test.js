import { describe, test, expect } from 'vitest';
import credits from '../src/components/credits.js';

describe('Credits Component', () => {
  test('T-06-9: credits view shows Tatoeba attribution', () => {
    const comp = credits();
    expect(comp.attribution).toContain('Tatoeba');
    expect(comp.attribution).toContain('CC-BY 2.0');
  });
});
