import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import onboarding from '../src/components/onboarding.js';
import { _setPlugin, initDb, getPref, getSessionState } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import "fake-indexeddb/auto";

describe('Onboarding Component', () => {
  let mockPlugin;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('T-06-2: onboarding stores pair and level', async () => {
    const comp = onboarding();
    // stub dispatch
    comp.$dispatch = vi.fn();
    
    comp.selectPair('en-de');
    comp.selectLevel('B1');
    comp.selectStrategy('topic-run');
    comp.setDailyLimit(20);
    
    await comp.complete();
    
    expect(await getPref('pair')).toBe('en-de');
    expect(await getPref('current_level')).toBe('B1');
    expect(await getPref('active_strategy')).toBe('topic-run');
    expect(await getPref('daily_new_limit')).toBe('20');
    expect(await getPref('onboarding_complete')).toBe('true');
    
    const ss = await getSessionState();
    expect(ss.active_strategy).toBe('topic-run');
    
    expect(comp.$dispatch).toHaveBeenCalledWith('navigate', 'practice');
  });

  test('T-06-3: daily limit rejects out-of-range values', async () => {
    const comp = onboarding();
    comp.step = 4;
    
    comp.setDailyLimit(3);
    expect(comp.dailyLimitError).toBe(true);
    await comp.next();
    // should not proceed
    expect(comp.step).toBe(4);
    
    comp.setDailyLimit(20);
    expect(comp.dailyLimitError).toBe(false);
    
    // mock sync function for next step
    vi.mock('../src/domain/sync.js', () => ({
      sync: vi.fn().mockResolvedValue({ success: true })
    }));
    
    // next will trigger performSync which changes step to 5
    // since sync is dynamic import or mocked, we just check dailyLimitError logic here.
  });
});
