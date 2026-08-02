import { describe, it, expect } from 'vitest';
import { computeSm2 } from '../src/domain/sm2.js';

describe('SM-2 Algorithm', () => {
  it('SM-2: again resets repetitions and sets interval=1', () => {
    const state = { ease: 2.5, interval_days: 6, repetitions: 2, state: 'review' };
    const result = computeSm2(state, 'again');
    expect(result.repetitions).toBe(0);
    expect(result.interval_days).toBe(1);
    expect(result.state).toBe('learning');
  });

  it('SM-2: good on new card → interval=1, reps=1', () => {
    const state = { ease: 2.5, interval_days: 0, repetitions: 0, state: 'new' };
    const result = computeSm2(state, 'good');
    expect(result.interval_days).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('SM-2: good on rep=1 → interval=6', () => {
    const state = { ease: 2.5, interval_days: 1, repetitions: 1, state: 'learning' };
    const result = computeSm2(state, 'good');
    expect(result.interval_days).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it('SM-2: good on rep=2 → interval = round(prev * ease)', () => {
    const state = { ease: 2.5, interval_days: 6, repetitions: 2, state: 'review' };
    const result = computeSm2(state, 'good');
    expect(result.interval_days).toBe(Math.round(6 * 2.5));
    expect(result.repetitions).toBe(3);
  });

  it('SM-2: ease never drops below 1.3', () => {
    let state = { ease: 1.3, interval_days: 1, repetitions: 1, state: 'learning' };
    const result = computeSm2(state, 'again');
    expect(result.ease).toBeGreaterThanOrEqual(1.3);
  });

  it.each([
    ['again', 2], ['hard', 3], ['good', 4], ['easy', 5]
  ])('SM-2: ease for %s (q=%d)', (grade, q) => {
    const ease = 2.5;
    const expected = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    const result = computeSm2({ ease, interval_days: 6, repetitions: 2, state: 'review' }, grade);
    expect(result.ease).toBeCloseTo(expected, 5);
  });
});
