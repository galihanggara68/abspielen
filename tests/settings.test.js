import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import settings from '../src/components/settings.js';
import { _setPlugin, initDb, updateSessionState, getSessionState, getCardState, getReviewLogs, getPref, setPref } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import { _resetDb, putChunk, getChunk } from '../src/db/indexeddb.js';
import { gradeCard } from '../src/domain/scheduler.js';
import { loadFixtures } from '../src/db/seed.js';
import "fake-indexeddb/auto";

describe('Settings Component', () => {
  let mockPlugin;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
    _resetDb();
    
    globalThis.window = {
      speechSynthesis: {
        getVoices: () => [{ lang: 'de-DE', name: 'German Voice' }]
      }
    };
    globalThis.speechSynthesis = globalThis.window.speechSynthesis;
  });

  afterEach(() => {
    mockPlugin.close();
    delete globalThis.window;
    delete globalThis.speechSynthesis;
  });

  test('T-06-6: changing strategy resets run state', async () => {
    await updateSessionState({ active_strategy: 'tag-run', current_run_key: 'travel', current_run_count: 3 });
    const comp = settings();
    await comp.init();
    await comp.changeStrategy('pure-srs');
    
    const ss = await getSessionState();
    expect(ss.active_strategy).toBe('pure-srs');
    expect(ss.current_run_key).toBeNull();
    expect(ss.current_run_count).toBe(0);
  });

  test('T-06-7: reset progress clears user state but keeps chunks', async () => {
    await loadFixtures();
    await setPref('onboarding_complete', 'true');
    // Simulate grading a card to generate user state
    await gradeCard('en-de-000001', 'good');
    
    expect(await getCardState('en-de-000001')).not.toBeNull();
    const logs = await getReviewLogs(0);
    expect(logs.length).toBeGreaterThan(0);
    
    // Simulate user confirming reset
    globalThis.confirm = vi.fn().mockReturnValue(true);
    globalThis.window = { confirm: globalThis.confirm };
    
    const comp = settings();
    await comp.init();
    await comp.resetProgress();
    
    // User state cleared
    expect(await getCardState('en-de-000001')).toBeNull();
    expect(await getReviewLogs(0)).toHaveLength(0);
    
    // Chunk still exists
    const chunk = await getChunk('fixtures-dev-001');
    expect(chunk).toBeDefined();
    expect(chunk.cards.length).toBeGreaterThan(0);
  });
});
