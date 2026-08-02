import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES, VALID_SOURCES } from './taxonomy.js';

export function validateCard(card) {
  if (!/^en-de-\d{6}$/.test(card.id)) throw new Error(`Invalid ID: ${card.id}`);
  if (card.pair !== 'en-de') throw new Error(`Invalid pair: ${card.pair}`);
  if (typeof card.sourceText !== 'string' || card.sourceText.trim() === '') throw new Error(`Invalid sourceText for ${card.id}`);
  if (typeof card.targetText !== 'string' || card.targetText.trim() === '') throw new Error(`Invalid targetText for ${card.id}`);
  if (!Array.isArray(card.altTargets) || card.altTargets.length > 2) throw new Error(`Invalid altTargets for ${card.id}`);
  card.altTargets.forEach(a => {
    if (typeof a !== 'string' || a.trim() === '') throw new Error(`Empty altTarget in ${card.id}`);
  });
  if (!VALID_CEFR.includes(card.cefr)) throw new Error(`Invalid CEFR: ${card.cefr} for ${card.id}`);
  if (!VALID_SENTENCE_TYPES.includes(card.sentenceType)) throw new Error(`Invalid sentenceType: ${card.sentenceType} for ${card.id}`);
  if (!Array.isArray(card.tags) || card.tags.length < 1 || card.tags.length > 3) throw new Error(`Invalid tags array for ${card.id}`);
  card.tags.forEach(t => {
    if (!VALID_TAGS.includes(t)) throw new Error(`invalid tag: ${t} for ${card.id}`);
  });
  if (typeof card.ipa !== 'string' || card.ipa.trim() === '') throw new Error(`Invalid ipa for ${card.id}`);
  if (!VALID_SOURCES.includes(card.source)) throw new Error(`Invalid source: ${card.source} for ${card.id}`);
  if (typeof card.version !== 'number' || card.version < 1) throw new Error(`Invalid version for ${card.id}`);
}

export function validateAndEmit(cards) {
  cards.forEach(validateCard);
}

async function computeHash(jsonContent) {
  return crypto.createHash('sha256').update(jsonContent).digest('hex');
}

async function main() {
  // Can be imported for testing without running main
  if (process.env.NODE_ENV === 'test') return;

  const inPath = path.resolve('tools/corpus/enriched/en-de.json');
  if (!fs.existsSync(inPath)) {
    console.error('Enriched input not found. Run gapfill.js first.');
    process.exit(1);
  }

  const cards = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  
  // Full validation
  try {
    validateAndEmit(cards);
  } catch (err) {
    console.error('Validation failed:', err.message);
    process.exit(1);
  }

  // Partitioning by CEFR level
  const byLevel = { A1: [], A2: [], B1: [], B2: [] };
  cards.forEach(c => byLevel[c.cefr].push(c));

  const docsDir = path.resolve('docs');
  const chunksDir = path.join(docsDir, 'chunks');
  const manifestsDir = path.join(docsDir, 'manifests');
  
  fs.mkdirSync(chunksDir, { recursive: true });
  fs.mkdirSync(manifestsDir, { recursive: true });

  const manifestPath = path.join(manifestsDir, 'manifest.en-de.json');
  let currentVersion = 0;
  if (fs.existsSync(manifestPath)) {
    const oldManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    currentVersion = oldManifest.version || 0;
  }
  currentVersion++;

  const chunkHashes = {};
  
  for (const cefr of VALID_CEFR) {
    const levelCards = byLevel[cefr];
    const maxPerChunk = 250;
    for (let i = 0; i < levelCards.length; i += maxPerChunk) {
      const chunkCards = levelCards.slice(i, i + maxPerChunk);
      const chunkIndex = Math.floor(i / maxPerChunk) + 1;
      const chunkName = `en-de-${cefr}-${String(chunkIndex).padStart(3, '0')}`;
      
      const jsonContent = JSON.stringify(chunkCards);
      const hash = await computeHash(jsonContent);
      chunkHashes[chunkName] = hash;
      
      const jsonPath = path.join(chunksDir, `${chunkName}.json`);
      const brPath = path.join(chunksDir, `${chunkName}.json.br`);
      
      fs.writeFileSync(jsonPath, jsonContent);
      const compressed = zlib.brotliCompressSync(Buffer.from(jsonContent, 'utf-8'));
      fs.writeFileSync(brPath, compressed);
    }
  }

  const manifest = {
    pair: 'en-de',
    version: currentVersion,
    generatedAt: new Date().toISOString(),
    chunkHashes
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const indexPath = path.join(docsDir, 'index.json');
  const index = {
    pairs: ['en-de'],
    manifests: {
      'en-de': 'manifests/manifest.en-de.json'
    }
  };
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`Emitted chunk files and manifest version ${currentVersion}`);
}

main().catch(console.error);
