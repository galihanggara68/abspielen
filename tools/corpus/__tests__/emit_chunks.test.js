import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { validateAndEmit } from '../emit_chunks.js';

async function computeHash(jsonContent) {
  return crypto.createHash('sha256').update(jsonContent).digest('hex');
}

describe('Emit Chunks', () => {
  it('emit rejects cards with invalid tags', () => {
    const badCard = {
      id: 'en-de-000001', pair: 'en-de', sourceText: 'Hi', targetText: 'Hallo',
      altTargets: [], cefr: 'A1', sentenceType: 'statement',
      tags: ['invalid-tag'], ipa: 'haloː', source: 'human', sourceRef: null, version: 1
    };
    expect(() => validateAndEmit([badCard])).toThrow(/invalid.*tag/i);
  });

  const docsDir = path.resolve(__dirname, '../../../docs');
  const manifestPath = path.join(docsDir, 'manifests/manifest.en-de.json');

  it('manifest hashes match recomputed hashes', async () => {
    if (!fs.existsSync(manifestPath)) return;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    for (const [chunkId, expectedHash] of Object.entries(manifest.chunkHashes)) {
      const chunkFile = path.join(docsDir, `chunks/${chunkId}.json`);
      const chunk = fs.readFileSync(chunkFile, 'utf-8');
      const actualHash = await computeHash(chunk);
      expect(actualHash).toBe(expectedHash);
    }
  });

  it('.json.br decompresses to valid JSON matching .json', () => {
    if (!fs.existsSync(manifestPath)) return;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    for (const chunkId of Object.keys(manifest.chunkHashes)) {
      const original = fs.readFileSync(path.join(docsDir, `chunks/${chunkId}.json`), 'utf-8');
      const compressed = fs.readFileSync(path.join(docsDir, `chunks/${chunkId}.json.br`));
      const decompressed = zlib.brotliDecompressSync(compressed).toString('utf-8');
      expect(decompressed).toBe(original);
    }
  });

  it('index.json lists en-de pair with manifest path', () => {
    const indexPath = path.join(docsDir, 'index.json');
    if (!fs.existsSync(indexPath)) return;
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    expect(index.pairs).toContain('en-de');
    expect(index.manifests['en-de']).toBe('manifests/manifest.en-de.json');
  });
});
