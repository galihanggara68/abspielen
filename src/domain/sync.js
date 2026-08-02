// src/domain/sync.js
import { fetchJson, fetchChunk, computeHash, diffManifests } from './sync-utils.js';
import { getManifest, putManifest, putChunk, deleteChunk } from '../db/indexeddb.js';
import { seedNewCards, setPref } from '../db/sqlite.js';

export async function sync(pair, baseUrl, options = {}) {
  const { onProgress = () => {}, deleteOrphans = false } = options;

  let totalChunks = 0;
  let currentChunk = 0;
  
  const reportProgress = (step) => {
    onProgress(step, currentChunk, totalChunks);
  };

  try {
    reportProgress('fetching_index');
    const indexUrl = `${baseUrl.replace(/\/$/, '')}/index.json`;
    const index = await fetchJson(indexUrl);

    if (!index.pairs || !index.pairs.includes(pair)) {
      return { success: false, error: `Language pair "${pair}" not available`, chunksDownloaded: 0, chunksDeleted: 0, cardsTotal: 0 };
    }

    reportProgress('fetching_manifest');
    const manifestPath = index.manifests[pair];
    const manifestUrl = `${baseUrl.replace(/\/$/, '')}/${manifestPath}`;
    const remoteManifest = await fetchJson(manifestUrl);

    const localManifest = await getManifest(pair);
    const { toDownload, toDelete } = diffManifests(localManifest, remoteManifest);

    totalChunks = toDownload.length;
    let chunksDownloaded = 0;
    let cardsTotal = 0;
    let chunksDeleted = 0;

    reportProgress('downloading');

    const cardIdsToSeed = [];

    for (const chunkId of toDownload) {
      try {
        const chunkUrl = `${baseUrl.replace(/\/$/, '')}/chunks/${chunkId}`;
        const chunk = await fetchChunk(chunkUrl);
        
        const hash = await computeHash(chunk);
        if (hash !== remoteManifest.chunkHashes[chunkId]) {
          console.warn(`Hash mismatch for chunk ${chunkId}`);
          currentChunk++;
          reportProgress('downloading');
          continue;
        }

        await putChunk(chunk);
        
        if (chunk.cards) {
          cardsTotal += chunk.cards.length;
          for (const card of chunk.cards) {
            cardIdsToSeed.push(card.id);
          }
        }
        
        chunksDownloaded++;
      } catch (err) {
        console.warn(`Failed to download chunk ${chunkId}`, err);
      }
      currentChunk++;
      reportProgress('downloading');
    }

    if (cardIdsToSeed.length > 0) {
      reportProgress('seeding');
      await seedNewCards(cardIdsToSeed);
    }

    if (deleteOrphans) {
      reportProgress('deleting');
      for (const chunkId of toDelete) {
        await deleteChunk(chunkId);
        chunksDeleted++;
      }
    }

    await putManifest(remoteManifest);

    const now = new Date().toISOString();
    await setPref('lastSyncAt', now);

    reportProgress('done');

    return {
      success: true,
      chunksDownloaded,
      chunksDeleted,
      cardsTotal,
      error: null
    };

  } catch (error) {
    return {
      success: false,
      chunksDownloaded: 0,
      chunksDeleted: 0,
      cardsTotal: 0,
      error: error.message || 'Sync failed'
    };
  }
}

export async function checkForUpdates(pair, baseUrl) {
  const indexUrl = `${baseUrl.replace(/\/$/, '')}/index.json`;
  const index = await fetchJson(indexUrl);

  if (!index.pairs || !index.pairs.includes(pair)) {
    throw new Error(`Language pair "${pair}" not available`);
  }

  const manifestPath = index.manifests[pair];
  const manifestUrl = `${baseUrl.replace(/\/$/, '')}/${manifestPath}`;
  const remoteManifest = await fetchJson(manifestUrl);

  const localManifest = await getManifest(pair);
  
  const { toDownload } = diffManifests(localManifest, remoteManifest);
  
  const currentVersion = localManifest ? localManifest.version : null;
  const remoteVersion = remoteManifest.version;

  return {
    updateAvailable: toDownload.length > 0 || currentVersion !== remoteVersion,
    currentVersion,
    remoteVersion,
    chunksToUpdate: toDownload.length
  };
}
