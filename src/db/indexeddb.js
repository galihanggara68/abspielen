import { openDB } from 'idb';

let _db = null;

export async function initChunkDb() {
  if (_db) return _db;
  _db = await openDB('abspielen', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('manifests')) {
        db.createObjectStore('manifests', { keyPath: 'pair' });
      }
    }
  });
  return _db;
}

export async function getChunk(id) {
  const db = await initChunkDb();
  return db.get('chunks', id);
}

export async function putChunk(chunk) {
  const db = await initChunkDb();
  return db.put('chunks', chunk);
}

export async function deleteChunk(id) {
  const db = await initChunkDb();
  return db.delete('chunks', id);
}

export async function getAllChunkIds() {
  const db = await initChunkDb();
  return db.getAllKeys('chunks');
}

export async function getManifest(pair) {
  const db = await initChunkDb();
  return db.get('manifests', pair);
}

export async function putManifest(manifest) {
  const db = await initChunkDb();
  return db.put('manifests', manifest);
}

export async function getCardsForLevel(pair, level) {
  const db = await initChunkDb();
  const chunks = await db.getAll('chunks');
  return chunks
    .filter(chunk => chunk.pair === pair)
    .flatMap(chunk => chunk.cards || [])
    .filter(card => card.cefr === level);
}

export async function getAllCards(pair) {
  const db = await initChunkDb();
  const chunks = await db.getAll('chunks');
  return chunks
    .filter(chunk => chunk.pair === pair)
    .flatMap(chunk => chunk.cards || []);
}

export function _resetDb() {
  if (_db) {
    _db.close();
  }
  _db = null;
}
