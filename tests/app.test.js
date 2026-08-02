import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../src/components/app.js';
import { _setPlugin, initDb, getPref, setPref } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import "fake-indexeddb/auto";

describe('App Component', () => {
  let mockPlugin;

  beforeEach(async () => {
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
    
    // Mock matchMedia and document
    globalThis.window = {
      matchMedia: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    };
    
    globalThis.document = {
      documentElement: {
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        }
      }
    };
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('T-06-1: onboarding shows when pref not set', async () => {
    const comp = app();
    await comp.init();
    expect(comp.currentScreen).toBe('onboarding');
  });

  test('T-06-1: onboarding skipped when already complete', async () => {
    await setPref('onboarding_complete', 'true');
    const comp = app();
    await comp.init();
    expect(comp.currentScreen).toBe('practice');
  });

  test('T-06-5: dark mode toggle persists and applies class', async () => {
    await setPref('dark_mode', 'true');
    const comp = app();
    await comp.init();
    
    // Test apply theme logic by checking class
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    await comp.toggleDarkMode(); // toggles to false
    
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(await getPref('dark_mode')).toBe('false');
  });
});
