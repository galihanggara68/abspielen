import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { sync, checkForUpdates } from '../src/domain/sync.js';
import { diffManifests, computeHash, fetchChunk } from '../src/domain/sync-utils.js';
import { _resetDb, putManifest, getChunk, putChunk } from '../src/db/indexeddb.js';
import { initDb, getCardState } from '../src/db/sqlite.js';
import { createMockPlugin } from './helpers/mock-sqlite-plugin.js';
import { _setPlugin } from '../src/db/sqlite.js';

describe('Sync Engine', () => {
  let mockFetchResponses = {};
  let mockPlugin;

  beforeEach(async () => {
    _resetDb();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('abspielen');
      req.onsuccess = resolve;
      req.onerror = resolve;
    });

    mockPlugin = await createMockPlugin();
    _setPlugin(mockPlugin);
    await initDb();
    
    global.fetch = vi.fn(async (url) => {
      for (const [key, value] of Object.entries(mockFetchResponses)) {
        if (url.endsWith(key) || url === key) {
          if (value === null) return { ok: false, status: 404 };
          if (value instanceof Error) throw value;
          return {
            ok: true,
            json: async () => value
          };
        }
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    mockFetchResponses = {};
    if (mockPlugin) {
      mockPlugin.close();
    }
  });

  const mockFetch = (responses) => {
    mockFetchResponses = responses;
  };

  test('diffManifests: detects new chunks', () => {
    const local = { chunkHashes: { 'c1': 'hash-a' } };
    const remote = { chunkHashes: { 'c1': 'hash-a', 'c2': 'hash-b' } };
    const diff = diffManifests(local, remote);
    expect(diff.toDownload).toEqual(['c2']);
    expect(diff.toDelete).toEqual([]);
  });

  test('diffManifests: detects changed chunks', () => {
    const local = { chunkHashes: { 'c1': 'hash-a' } };
    const remote = { chunkHashes: { 'c1': 'hash-b' } };
    const diff = diffManifests(local, remote);
    expect(diff.toDownload).toEqual(['c1']);
  });

  test('diffManifests: detects deleted chunks', () => {
    const local = { chunkHashes: { 'c1': 'hash-a', 'c2': 'hash-b' } };
    const remote = { chunkHashes: { 'c1': 'hash-a' } };
    const diff = diffManifests(local, remote);
    expect(diff.toDelete).toEqual(['c2']);
  });

  test('diffManifests: first sync downloads everything', () => {
    const remote = { chunkHashes: { 'c1': 'hash-a', 'c2': 'hash-b' } };
    const diff = diffManifests(null, remote);
    expect(diff.toDownload).toEqual(['c1', 'c2']);
    expect(diff.toDelete).toEqual([]);
  });

  test('sync: downloads new chunks and seeds cards', async () => {
    const chunkObj = {
      id: 'c1', pair: 'en-de', level: 'A1',
      cards: [{ id: 'en-de-000001' }, { id: 'en-de-000002' }]
    };
    const c1Hash = await computeHash(chunkObj);
    
    mockFetch({
      'base/index.json': { pairs: ['en-de'], manifests: { 'en-de': 'manifests/manifest.en-de.json' } },
      'base/manifests/manifest.en-de.json': {
        pair: 'en-de', version: 1,
        levels: { A1: { count: 2, chunks: ['c1'] } },
        chunkHashes: { c1: c1Hash }
      },
      'base/chunks/c1.json.br': chunkObj
    });

    const result = await sync('en-de', 'base/', {});
    expect(result.success).toBe(true);
    expect(result.chunksDownloaded).toBe(1);
    expect(result.cardsTotal).toBe(2);

    const chunk = await getChunk('c1');
    expect(chunk.cards).toHaveLength(2);

    const cs1 = await getCardState('en-de-000001');
    expect(cs1.state).toBe('new');
  });

  test('sync: fails when pair not in index', async () => {
    mockFetch({
      'base/index.json': { pairs: ['en-fr'], manifests: { 'en-fr': 'manifests/manifest.en-fr.json' } }
    });
    const result = await sync('en-de', 'base/', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('en-de');
  });

  test('sync: reports progress', async () => {
    const chunkObj = { id: 'c1', pair: 'en-de', cards: [] };
    const c1Hash = await computeHash(chunkObj);
    mockFetch({
      'base/index.json': { pairs: ['en-de'], manifests: { 'en-de': 'manifests/manifest.en-de.json' } },
      'base/manifests/manifest.en-de.json': {
        pair: 'en-de', version: 1,
        chunkHashes: { c1: c1Hash }
      },
      'base/chunks/c1.json.br': chunkObj
    });
    const progress = [];
    await sync('en-de', 'base/', { onProgress: (step, cur, total) => progress.push({ step, cur, total }) });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.some(p => p.step === 'downloading')).toBe(true);
  });

  test('checkForUpdates: detects available update', async () => {
    await putManifest({ pair: 'en-de', version: 2, chunkHashes: { c1: 'h1' } });
    mockFetch({
      'base/index.json': { pairs: ['en-de'], manifests: { 'en-de': 'manifests/manifest.en-de.json' } },
      'base/manifests/manifest.en-de.json': {
        pair: 'en-de', version: 3,
        chunkHashes: { c1: 'h1', c2: 'h2' }
      }
    });
    const result = await checkForUpdates('en-de', 'base/');
    expect(result.updateAvailable).toBe(true);
    expect(result.currentVersion).toBe(2);
    expect(result.remoteVersion).toBe(3);
    expect(result.chunksToUpdate).toBe(1);
  });

  test('checkForUpdates: no update available', async () => {
    await putManifest({ pair: 'en-de', version: 2, chunkHashes: { c1: 'h1' } });
    mockFetch({
      'base/index.json': { pairs: ['en-de'], manifests: { 'en-de': 'manifests/manifest.en-de.json' } },
      'base/manifests/manifest.en-de.json': {
        pair: 'en-de', version: 2,
        chunkHashes: { c1: 'h1' }
      }
    });
    const result = await checkForUpdates('en-de', 'base/');
    expect(result.updateAvailable).toBe(false);
  });

  test('computeHash: same input -> same hash', async () => {
    const obj = { id: 'test', cards: [{ id: 'c1' }] };
    const h1 = await computeHash(obj);
    const h2 = await computeHash(obj);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256-/);
  });

  test('fetchChunk: falls back to .json when .br fails', async () => {
    mockFetch({
      'base/chunks/c1.json.br': null, // 404
      'base/chunks/c1.json': { id: 'c1', cards: [] }
    });
    const chunk = await fetchChunk('base/chunks/c1');
    expect(chunk.id).toBe('c1');
  });

  test('sync: hash mismatch skips chunk', async () => {
    mockFetch({
      'base/index.json': { pairs: ['en-de'], manifests: { 'en-de': 'manifests/manifest.en-de.json' } },
      'base/manifests/manifest.en-de.json': {
        pair: 'en-de', version: 1,
        chunkHashes: { c1: 'wrong-hash' }
      },
      'base/chunks/c1.json.br': { id: 'c1', pair: 'en-de', cards: [] }
    });
    
    const result = await sync('en-de', 'base/', {});
    expect(result.success).toBe(true);
    expect(result.chunksDownloaded).toBe(0);
    
    const chunk = await getChunk('c1');
    expect(chunk).toBeUndefined();
  });

  test('sync: network error graceful', async () => {
    mockFetch({
      'base/index.json': new Error('Network error')
    });
    
    const result = await sync('en-de', 'base/', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  test('sync: deleteOrphans keeps chunks when false, deletes when true', async () => {
    await putChunk({ id: 'c_orphan', cards: [] });
    await putManifest({ pair: 'en-de', version: 1, chunkHashes: { c_orphan: 'h1' } });
    
    mockFetch({
      'base/index.json': { pairs: ['en-de'], manifests: { 'en-de': 'manifests/manifest.en-de.json' } },
      'base/manifests/manifest.en-de.json': {
        pair: 'en-de', version: 2,
        chunkHashes: {}
      }
    });
    
    const res1 = await sync('en-de', 'base/', { deleteOrphans: false });
    expect(res1.chunksDeleted).toBe(0);
    let orphan = await getChunk('c_orphan');
    expect(orphan).toBeDefined();
    
    // Reset local manifest for second test because it was overwritten by the first sync
    await putManifest({ pair: 'en-de', version: 1, chunkHashes: { c_orphan: 'h1' } });

    const res2 = await sync('en-de', 'base/', { deleteOrphans: true });
    expect(res2.chunksDeleted).toBe(1);
    orphan = await getChunk('c_orphan');
    expect(orphan).toBeUndefined();
  });
});
