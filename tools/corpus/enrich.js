import fs from 'fs';
import path from 'path';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES } from './taxonomy.js';

function mockLLMEnrich(sourceText, targetText, index) {
  // Deterministic mock enrichment for testing purposes
  const cefrLevels = VALID_CEFR;
  const types = VALID_SENTENCE_TYPES;
  
  // Try to distribute tags and levels evenly
  const cefr = cefrLevels[index % cefrLevels.length];
  const sentenceType = types[index % types.length];
  const tag1 = VALID_TAGS[index % VALID_TAGS.length];
  const tag2 = VALID_TAGS[(index + 1) % VALID_TAGS.length];
  const tags = [tag1, tag2];
  
  return {
    cefr,
    sentenceType,
    tags,
    altTargets: [], // 0-2
    ipa: `mɒk aɪ-pi-eɪ fɔː ${targetText.substring(0, 10).toLowerCase()}`
  };
}

async function enrich(item, index) {
  if (process.env.OPENAI_API_KEY) {
    // In a real scenario, we'd call an LLM API here.
    // Keeping it simple for the test setup, or implement actual fetch here.
    console.warn('Real LLM not fully implemented, falling back to mock');
  }
  
  const enriched = mockLLMEnrich(item.sourceText, item.targetText, index);
  
  return {
    ...enriched,
    id: `en-de-${String(index + 1).padStart(6, '0')}`,
    pair: 'en-de',
    sourceText: item.sourceText,
    targetText: item.targetText,
    source: 'tatoeba',
    sourceRef: `tatoeba:${item.toebaId}`,
    version: 1
  };
}

function validateEnriched(card) {
  if (!VALID_CEFR.includes(card.cefr)) return false;
  if (!VALID_SENTENCE_TYPES.includes(card.sentenceType)) return false;
  if (!Array.isArray(card.tags) || card.tags.length < 1 || card.tags.length > 3) return false;
  for (const t of card.tags) {
    if (!VALID_TAGS.includes(t)) return false;
  }
  if (!card.ipa || typeof card.ipa !== 'string') return false;
  return true;
}

async function main() {
  const inPath = path.resolve('tools/corpus/raw/tatoeba-en-de.json');
  if (!fs.existsSync(inPath)) {
    console.error('Raw input not found. Run fetch_tatoeba.js first.');
    process.exit(1);
  }
  
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  const enrichedList = [];
  
  let invalidCount = 0;
  
  for (let i = 0; i < raw.length; i++) {
    const card = await enrich(raw[i], i);
    if (validateEnriched(card)) {
      enrichedList.push(card);
    } else {
      invalidCount++;
      console.warn(`Card ${card.id} rejected due to invalid LLM output:`, card);
    }
  }

  const outPath = path.resolve('tools/corpus/enriched/en-de.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(enrichedList, null, 2));
  
  console.log(`Enrichment complete. Wrote ${enrichedList.length} valid cards.`);
  if (invalidCount > 0) {
    console.log(`Rejected ${invalidCount} cards with invalid output.`);
  }
}

main().catch(console.error);
