import { describe, test, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { initChunkDb, getChunk, putChunk, deleteChunk, getAllChunkIds, getManifest, putManifest, getCardsForLevel, getAllCards, _resetDb } from '../src/db/indexeddb.js';

describe('IndexedDB Data Layer', () => {
  beforeEach(async () => {
    _resetDb();
    // Delete the database to start fresh
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('abspielen');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  test('initChunkDb creates chunks and manifests stores', async () => {
    const db = await initChunkDb();
    expect(db.objectStoreNames.contains('chunks')).toBe(true);
    expect(db.objectStoreNames.contains('manifests')).toBe(true);
  });

  test('putChunk and getChunk round-trip', async () => {
    const chunk = { id: 'en-de-A1-001', pair: 'en-de', level: 'A1', cards: [{ id: 'c1', cefr: 'A1' }] };
    await putChunk(chunk);
    const result = await getChunk('en-de-A1-001');
    expect(result).toEqual(chunk);
  });

  test('deleteChunk removes the chunk', async () => {
    const chunk = { id: 'ch1', pair: 'en-de', level: 'A1', cards: [] };
    await putChunk(chunk);
    await deleteChunk('ch1');
    const result = await getChunk('ch1');
    expect(result).toBeUndefined();
  });

  test('getAllChunkIds returns all stored IDs', async () => {
    await putChunk({ id: 'ch1', pair: 'en-de', level: 'A1', cards: [] });
    await putChunk({ id: 'ch2', pair: 'en-de', level: 'A2', cards: [] });
    const ids = await getAllChunkIds();
    expect(ids.sort()).toEqual(['ch1', 'ch2']);
  });

  test('putManifest and getManifest round-trip', async () => {
    const manifest = { pair: 'en-de', chunks: ['ch1', 'ch2'], hash: 'abc123' };
    await putManifest(manifest);
    const result = await getManifest('en-de');
    expect(result).toEqual(manifest);
  });

  test('getCardsForLevel aggregates cards across multiple chunks', async () => {
    await putChunk({ id: 'ch1', pair: 'en-de', level: 'A1', cards: [
      { id: 'c1', cefr: 'A1' }, { id: 'c2', cefr: 'A2' }
    ]});
    await putChunk({ id: 'ch2', pair: 'en-de', level: 'A1', cards: [
      { id: 'c3', cefr: 'A1' }
    ]});
    await putChunk({ id: 'ch3', pair: 'fr-de', level: 'A1', cards: [
      { id: 'c4', cefr: 'A1' }
    ]});

    const a1Cards = await getCardsForLevel('en-de', 'A1');
    expect(a1Cards).toHaveLength(2);
    expect(a1Cards.map(c => c.id).sort()).toEqual(['c1', 'c3']);
  });

  test('getAllCards returns all cards for a pair', async () => {
    await putChunk({ id: 'ch1', pair: 'en-de', level: 'A1', cards: [
      { id: 'c1', cefr: 'A1' }, { id: 'c2', cefr: 'A2' }
    ]});
    await putChunk({ id: 'ch2', pair: 'en-de', level: 'B1', cards: [
      { id: 'c3', cefr: 'B1' }
    ]});
    await putChunk({ id: 'ch3', pair: 'fr-de', level: 'A1', cards: [
      { id: 'c4', cefr: 'A1' }
    ]});

    const cards = await getAllCards('en-de');
    expect(cards).toHaveLength(3);
    expect(cards.map(c => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });
});
