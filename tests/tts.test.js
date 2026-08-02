import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { hasGermanVoice } from '../src/domain/tts.js';

describe('TTS', () => {
  beforeEach(() => {
    globalThis.speechSynthesis = undefined;
  });

  afterEach(() => {
    globalThis.speechSynthesis = undefined;
  });

  test('hasGermanVoice returns false when no de voice', async () => {
    globalThis.speechSynthesis = { getVoices: () => [] };
    expect(await hasGermanVoice()).toBe(false);
  });

  test('hasGermanVoice returns true when de-DE voice exists', async () => {
    globalThis.speechSynthesis = { getVoices: () => [{ lang: 'de-DE' }] };
    expect(await hasGermanVoice()).toBe(true);
  });
});
