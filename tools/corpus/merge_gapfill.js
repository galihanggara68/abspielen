import fs from 'fs';
import path from 'path';
import { validateCard } from './validate.js';
import { readJsonl } from './enrich.js';

// Pure merge: existing enriched cards + skill-produced gapfill records →
// appended cards with deterministic ids/source. Returns the new card array
// plus counts. Does NOT mutate the input arrays.
export function mergeGapfill(existingCards, incoming) {
  let nextId = 1;
  for (const c of existingCards) {
    const m = /^en-de-(\d{6})$/.exec(c.id || '');
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= nextId) nextId = num + 1;
    }
  }

  const cards = [...existingCards];
  const rejected = [];
  let merged = 0;

  for (const rec of incoming) {
    const card = {
      id: `en-de-${String(nextId).padStart(6, '0')}`,
      pair: 'en-de',
      sourceText: rec.sourceText,
      targetText: rec.targetText,
      altTargets: Array.isArray(rec.altTargets) ? rec.altTargets : [],
      cefr: rec.cefr,
      sentenceType: rec.sentenceType,
      tags: rec.tags,
      ipa: rec.ipa,
      source: 'ai',
      sourceRef: null,
      version: 1,
    };

    const { valid, errors } = validateCard(card);
    if (valid) {
      cards.push(card);
      nextId++;
      merged++;
      if (rec.gapReason) console.log(`Merged ${card.id} (gapReason: ${rec.gapReason})`);
    } else {
      rejected.push({ id: card.id, errors });
      console.warn(`Rejected gapfill card ${card.id}: ${errors.join('; ')}`);
    }
  }

  return { cards, merged, rejected };
}

function main() {
  const enrichPath = path.resolve('tools/corpus/enriched/en-de.json');
  const gapPath = path.resolve('tools/corpus/work/gapfill-cards.jsonl');

  if (!fs.existsSync(enrichPath)) {
    console.error('Enriched input not found. Run `./tools/corpus/run_pipeline.sh enrich` first.');
    process.exit(1);
  }
  if (!fs.existsSync(gapPath)) {
    console.error(
      'Gapfill cards not found at tools/corpus/work/gapfill-cards.jsonl.\n' +
      'Run the /corpus-gapfill skill to produce it.'
    );
    process.exit(1);
  }

  const existing = JSON.parse(fs.readFileSync(enrichPath, 'utf-8'));
  const incoming = readJsonl(gapPath);

  const { cards, merged, rejected } = mergeGapfill(existing, incoming);

  fs.writeFileSync(enrichPath, JSON.stringify(cards, null, 2));

  console.log(`Merged ${merged} gapfill cards. Total now: ${cards.length}.`);
  if (rejected.length) console.log(`Rejected ${rejected.length} invalid gapfill cards.`);
}

if (process.env.NODE_ENV !== 'test') main();
