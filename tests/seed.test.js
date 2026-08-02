import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import { _setPlugin, initDb, countCardsByState } from '../src/db/sqlite.js';
import { getChunk, _resetDb } from '../src/db/indexeddb.js';
import { loadFixtures } from '../src/db/seed.js';

describe('Seed Module', () => {
  let mockPlugin;

  beforeEach(async () => {
    // Reset IndexedDB
    _resetDb();
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('abspielen');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Reset SQLite
    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
  });

  afterEach(() => {
    mockPlugin.close();
  });

  test('loadFixtures stores chunk in IndexedDB and seeds card_state', async () => {
    await loadFixtures();

    // Verify chunk in IndexedDB
    const chunk = await getChunk('fixtures-dev-001');
    expect(chunk).toBeDefined();
    expect(chunk.cards).toHaveLength(10);

    // Verify card_state rows in SQLite
    const newCount = await countCardsByState('new');
    expect(newCount).toBe(10);
  });
});
