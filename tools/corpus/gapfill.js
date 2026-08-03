import fs from 'fs';
import path from 'path';
import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES } from './taxonomy.js';

const TAG_MIN = 8;       // each tag wants >= 8 cards
const TYPE_PER_LEVEL = 2; // each sentenceType per CEFR wants >= 2
const LEVEL_MIN = 85;    // each CEFR level wants >= 85 cards

// Pure gap computation. Reads the corpus, returns { totals, gaps }.
// Does NOT mutate the input. Each gap is one record whose `deficit` says how
// many cards the skill should produce; `suggested` is the script's best guess
// at a balancing cell (the skill may override).
export function computeGaps(cards) {
  const tagCounts = {};
  const levelCounts = {};
  const typeByLevel = {};

  VALID_TAGS.forEach(t => (tagCounts[t] = 0));
  VALID_CEFR.forEach(c => {
    levelCounts[c] = 0;
    typeByLevel[c] = {};
    VALID_SENTENCE_TYPES.forEach(s => (typeByLevel[c][s] = 0));
  });

  for (const card of cards) {
    if (!VALID_CEFR.includes(card.cefr)) continue;
    levelCounts[card.cefr]++;
    if (VALID_SENTENCE_TYPES.includes(card.sentenceType)) {
      typeByLevel[card.cefr][card.sentenceType]++;
    }
    for (const t of card.tags) {
      if (tagCounts.hasOwnProperty(t)) tagCounts[t]++;
    }
  }

  const fewestLevel = () => VALID_CEFR.reduce((a, b) => (levelCounts[a] <= levelCounts[b] ? a : b));
  const fewestTypeAt = cefr =>
    VALID_SENTENCE_TYPES.reduce((a, b) => (typeByLevel[cefr][a] <= typeByLevel[cefr][b] ? a : b));
  const fewestTag = () => VALID_TAGS.reduce((a, b) => (tagCounts[a] <= tagCounts[b] ? a : b));

  const gaps = [];

  // Gap 1: tag-min — each tag wants TAG_MIN cards.
  for (const tag of VALID_TAGS) {
    if (tagCounts[tag] < TAG_MIN) {
      const cefr = fewestLevel();
      gaps.push({
        reason: 'tag-min',
        tag,
        deficit: TAG_MIN - tagCounts[tag],
        suggested: { cefr, sentenceType: fewestTypeAt(cefr) },
      });
    }
  }

  // Gap 2: type-per-level — each sentenceType at each level wants TYPE_PER_LEVEL.
  for (const cefr of VALID_CEFR) {
    for (const sentenceType of VALID_SENTENCE_TYPES) {
      const have = typeByLevel[cefr][sentenceType];
      if (have < TYPE_PER_LEVEL) {
        gaps.push({
          reason: 'type-per-level',
          cefr,
          sentenceType,
          deficit: TYPE_PER_LEVEL - have,
          suggested: { tag: fewestTag() },
        });
      }
    }
  }

  // Gap 3: level-min — each level wants LEVEL_MIN cards.
  for (const cefr of VALID_CEFR) {
    if (levelCounts[cefr] < LEVEL_MIN) {
      gaps.push({
        reason: 'level-min',
        cefr,
        deficit: LEVEL_MIN - levelCounts[cefr],
        suggested: { tag: fewestTag(), sentenceType: fewestTypeAt(cefr) },
      });
    }
  }

  const totals = {
    cards: cards.length,
    byLevel: { ...levelCounts },
  };

  return { totals, gaps };
}

function main() {
  const inPath = path.resolve('tools/corpus/enriched/en-de.json');
  if (!fs.existsSync(inPath)) {
    console.error('Enriched input not found. Run `./tools/corpus/run_pipeline.sh enrich` first.');
    process.exit(1);
  }

  const cards = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  const { totals, gaps } = computeGaps(cards);

  const outDir = path.resolve('tools/corpus/work');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'gaps.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        pair: 'en-de',
        totals,
        gaps,
      },
      null,
      2
    )
  );

  console.log(`Wrote ${gaps.length} gaps (${totals.cards} cards across levels ${JSON.stringify(totals.byLevel)}).`);
  console.log('Run the /corpus-gapfill skill to generate fill cards.');
}

if (process.env.NODE_ENV !== 'test') main();
