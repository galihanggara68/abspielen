import fs from 'fs';
import path from 'path';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES } from './taxonomy.js';

function mockAIGenerateCard(idNum, tag, cefr, sentenceType) {
  return {
    id: `en-de-${String(idNum).padStart(6, '0')}`,
    pair: 'en-de',
    sourceText: `Generated text for ${tag} at ${cefr} (${sentenceType})`,
    targetText: `Generierter Text für ${tag} auf ${cefr} (${sentenceType})`,
    altTargets: [],
    cefr,
    sentenceType,
    tags: [tag],
    ipa: `dʒɛnəreɪtɪd ˈaɪ-pi-eɪ ${idNum}`,
    source: 'ai',
    sourceRef: null,
    version: 1
  };
}

async function main() {
  const inPath = path.resolve('tools/corpus/enriched/en-de.json');
  if (!fs.existsSync(inPath)) {
    console.error('Enriched input not found. Run enrich.js first.');
    process.exit(1);
  }

  const cards = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  let nextId = cards.length + 1; // Assuming sequential ids starting from 1
  
  // Find highest id to be safe
  for (const c of cards) {
    const num = parseInt(c.id.split('-').pop(), 10);
    if (num >= nextId) nextId = num + 1;
  }

  // Calculate stats
  const tagCounts = {};
  const levelCounts = {};
  const sentenceTypeCounts = {}; // By level: { A1: { statement: 0, ... } }
  
  VALID_TAGS.forEach(t => tagCounts[t] = 0);
  VALID_CEFR.forEach(c => {
    levelCounts[c] = 0;
    sentenceTypeCounts[c] = {};
    VALID_SENTENCE_TYPES.forEach(s => sentenceTypeCounts[c][s] = 0);
  });

  function tally(card) {
    card.tags.forEach(t => tagCounts[t]++);
    levelCounts[card.cefr]++;
    sentenceTypeCounts[card.cefr][card.sentenceType]++;
  }
  
  cards.forEach(tally);

  const generated = [];

  // Gap 1: ≥8 cards per tag
  for (const tag of VALID_TAGS) {
    while (tagCounts[tag] < 8) {
      // Pick the level with fewest cards to balance
      const cefr = VALID_CEFR.reduce((a, b) => levelCounts[a] < levelCounts[b] ? a : b);
      const sentenceType = VALID_SENTENCE_TYPES.reduce((a, b) => 
        sentenceTypeCounts[cefr][a] < sentenceTypeCounts[cefr][b] ? a : b
      );
      const newCard = mockAIGenerateCard(nextId++, tag, cefr, sentenceType);
      generated.push(newCard);
      tally(newCard);
    }
  }

  // Gap 2: ≥2 per sentenceType per level
  for (const cefr of VALID_CEFR) {
    for (const sentenceType of VALID_SENTENCE_TYPES) {
      while (sentenceTypeCounts[cefr][sentenceType] < 2) {
        // Pick a tag that could use more
        const tag = VALID_TAGS.reduce((a, b) => tagCounts[a] < tagCounts[b] ? a : b);
        const newCard = mockAIGenerateCard(nextId++, tag, cefr, sentenceType);
        generated.push(newCard);
        tally(newCard);
      }
    }
  }

  // Gap 3: ~100 total per CEFR level (min 80, aim for 100)
  for (const cefr of VALID_CEFR) {
    while (levelCounts[cefr] < 85) {
      const tag = VALID_TAGS.reduce((a, b) => tagCounts[a] < tagCounts[b] ? a : b);
      const sentenceType = VALID_SENTENCE_TYPES[Math.floor(Math.random() * VALID_SENTENCE_TYPES.length)];
      const newCard = mockAIGenerateCard(nextId++, tag, cefr, sentenceType);
      generated.push(newCard);
      tally(newCard);
    }
  }

  const resultCards = [...cards, ...generated];
  fs.writeFileSync(inPath, JSON.stringify(resultCards, null, 2));

  console.log(`Gapfill complete. Generated ${generated.length} AI cards. Total cards: ${resultCards.length}`);
}

main().catch(console.error);
