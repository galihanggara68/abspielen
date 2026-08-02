// src/domain/sync-utils.js
export async function fetchJson(url) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

export async function fetchChunk(url) {
  try {
    return await fetchJson(`${url}.json.br`);
  } catch (err) {
    return await fetchJson(`${url}.json`);
  }
}

export async function computeHash(chunk) {
  const str = JSON.stringify(chunk);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function diffManifests(local, remote) {
  const toDownload = [];
  const toDelete = [];
  
  const localHashes = local ? (local.chunkHashes || {}) : {};
  const remoteHashes = remote ? (remote.chunkHashes || {}) : {};

  for (const [chunkId, hash] of Object.entries(remoteHashes)) {
    if (localHashes[chunkId] !== hash) {
      toDownload.push(chunkId);
    }
  }

  for (const chunkId of Object.keys(localHashes)) {
    if (!(chunkId in remoteHashes)) {
      toDelete.push(chunkId);
    }
  }

  return { toDownload, toDelete };
}
