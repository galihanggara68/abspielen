import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import practice from '../src/components/practice.js';
import sessionStore from '../src/stores/session.js';
import { _setPlugin, initDb } from '../src/db/sqlite.js';
import { _resetDb } from '../src/db/indexeddb.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import "fake-indexeddb/auto";

describe('Practice Component', () => {
  let mockPlugin;
  let comp;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
    _resetDb();
    globalThis.speechSynthesis = {
      getVoices: () => [{ lang: 'de-DE' }],
      speak: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    
    comp = practice();
    comp.$store = { session: sessionStore };
    await comp.init();
  });

  afterEach(() => {
    mockPlugin.close();
    globalThis.speechSynthesis = undefined;
  });

  test('AC-03-13: Practice component loads and displays the first card', () => {
    expect(comp.currentCard).not.toBeNull();
    expect(comp.currentCard.sourceText).toBeTruthy();
    expect(comp.revealed).toBe(false);
  });

  test('AC-03-14: Clicking "Show answer" reveals targetText and grade buttons', () => {
    expect(comp.revealed).toBe(false);
    comp.reveal();
    expect(comp.revealed).toBe(true);
  });

  test('AC-03-15: Clicking a grade button loads the next card', async () => {
    const firstId = comp.currentCard.id;
    await comp.grade('good');
    expect(comp.currentCard.id).not.toBe(firstId);
    expect(comp.cardsSeenSession).toBe(1);
    expect(comp.revealed).toBe(false);
  });

  test('AC-03-16: TTS listen button is hidden when hasGermanVoice() returns false', async () => {
    globalThis.speechSynthesis = { 
      getVoices: () => [], 
      addEventListener: vi.fn(), 
      removeEventListener: vi.fn() 
    };
    const compNoTTS = practice();
    compNoTTS.$store = { session: sessionStore };
    await compNoTTS.init();
    expect(compNoTTS.hasTts).toBe(false);
  });

  test('AC-03-17: IPA text toggles visibility when IPA button is clicked', () => {
    expect(comp.showIpa).toBe(false);
    comp.toggleIpa();
    expect(comp.showIpa).toBe(true);
  });

  test('AC-03-18: After grading all fixture cards, session-done message appears', async () => {
    // Grade enough cards to hit the daily_new_limit (which defaults to 20, we have 10 fixtures)
    // Actually we just loop until currentCard is null.
    let count = 0;
    while (comp.currentCard && count < 20) {
      await comp.grade('good');
      count++;
    }
    expect(comp.currentCard).toBeNull();
    expect(comp.sessionDone).toBe(true);
    // Fixtures contain 10 cards.
    expect(count).toBe(10);
  });
  
  test('AC-03-19: Daily counter resets when now >= dayResetAt', async () => {
    await comp.grade('good');
    expect(comp.$store.session.cardsSeenToday).toBe(1);
    
    // Force day reset logic
    comp.$store.session.dayResetAt = Date.now() - 1000;
    await comp.$store.session.checkDayReset();
    
    expect(comp.$store.session.cardsSeenToday).toBe(0);
  });

  test('listen() calls speechSynthesis.speak', () => {
    comp.listen();
    expect(globalThis.speechSynthesis.speak).toHaveBeenCalled();
  });
});
