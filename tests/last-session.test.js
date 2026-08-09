import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import lastSession from '../src/components/last-session.js';
import sessionStore from '../src/stores/session.js';
import { _setPlugin, initDb, insertReviewLog } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import { _resetDb, putChunk } from '../src/db/indexeddb.js';
import "fake-indexeddb/auto";
import { TextToSpeech } from '@capacitor-community/text-to-speech';

vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    isLanguageSupported: vi.fn(),
    getSupportedLanguages: vi.fn(),
    speak: vi.fn()
  }
}));

describe('Last Session Component', () => {
  let mockPlugin;
  let comp;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
    _resetDb();
    
    TextToSpeech.isLanguageSupported.mockResolvedValue({ supported: true });
    TextToSpeech.speak.mockClear();
    
    comp = lastSession();
    comp.$store = { session: sessionStore };
    
    await putChunk({
      id: 'chunk1',
      pair: 'en-de',
      cards: [
        { id: 'c1', sourceText: 'Hello', targetText: 'Hallo', ipa: 'halo' }
      ]
    });
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('init fetches logs for currentSessionId and maps with card data', async () => {
    await import('../src/db/sqlite.js').then(m => m.updateSessionState({ current_session_id: 'sess-1' }));
    await insertReviewLog({ card_id: 'c1', reviewed_at: 1000, grade: 'good', prev_ease: 2.5, prev_interval: 0, prev_reps: 0, new_ease: 2.6, new_interval: 1, new_reps: 1, session_id: 'sess-1', note: 'my note' });
    
    await comp.init();
    
    expect(comp.turns).toHaveLength(1);
    expect(comp.turns[0].card_id).toBe('c1');
    expect(comp.turns[0].note).toBe('my note');
    expect(comp.turns[0].sourceText).toBe('Hello');
    expect(comp.turns[0].targetText).toBe('Hallo');
  });

  test('returns empty if no sessionId', async () => {
    comp.$store.session.currentSessionId = null;
    await comp.init();
    expect(comp.turns).toHaveLength(0);
  });
});
