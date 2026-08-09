import { describe, test, expect, vi } from 'vitest';
import { hasGermanVoice } from '../src/domain/tts.js';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    isLanguageSupported: vi.fn(),
    getSupportedLanguages: vi.fn(),
    speak: vi.fn()
  }
}));

describe('TTS', () => {
  test('hasGermanVoice returns false when no de voice', async () => {
    TextToSpeech.isLanguageSupported.mockResolvedValueOnce({ supported: false });
    TextToSpeech.getSupportedLanguages.mockResolvedValueOnce({ languages: ['en-US'] });
    expect(await hasGermanVoice()).toBe(false);
  });

  test('hasGermanVoice returns true when de-DE is supported', async () => {
    TextToSpeech.isLanguageSupported.mockResolvedValueOnce({ supported: true });
    expect(await hasGermanVoice()).toBe(true);
  });
  
  test('hasGermanVoice returns true when fallback check finds de', async () => {
    TextToSpeech.isLanguageSupported.mockResolvedValueOnce({ supported: false });
    TextToSpeech.getSupportedLanguages.mockResolvedValueOnce({ languages: ['en-US', 'de-AT'] });
    expect(await hasGermanVoice()).toBe(true);
  });
});
