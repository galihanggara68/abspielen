import fs from 'fs';
import path from 'path';
import { validateCard } from './validate.js';

// Read a JSONL file into an array of parsed objects. Blank lines are skipped.
// A malformed trailing line (e.g. from an interrupted skill pass) is skipped
// with a warning rather than crashing the whole run.
export function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const out = [];
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') return;
    try {
      out.push(JSON.parse(trimmed));
    } catch (err) {
      console.warn(`Skipping malformed JSONL line ${i + 1} in ${filePath}: ${err.message}`);
    }
  });
  return out;
}

// Pure join: raw items + enrichment records → validated cards.
// Enrichment records are matched to raw items by `toebaId`. The skill does NOT
// assign ids/source/sourceRef/version — those are deterministic here.
export function joinEnrichment(raw, enrichment) {
  const byToebaId = new Map();
  for (const rec of enrichment) {
    if (!rec || typeof rec.toebaId !== 'number') continue;
    byToebaId.set(rec.toebaId, rec);
  }

  const cards = [];
  const skipped = [];
  const rejected = [];
  const usedToebaIds = new Set();
  let nextId = 1;

  let duplicates = 0;
  for (const item of raw) {
    const rec = byToebaId.get(item.toebaId);
    if (!rec) {
      if (!usedToebaIds.has(item.toebaId)) skipped.push(item.toebaId);
      continue;
    }
    // Raw may contain duplicate toebaIds (same English, different German translations).
    // Enrichment is keyed by toebaId, so only the first occurrence becomes a card;
    // later duplicates are skipped (alternative translations can be captured via
    // altTargets by the skill).
    if (usedToebaIds.has(item.toebaId)) {
      duplicates++;
      continue;
    }
    usedToebaIds.add(item.toebaId);

    const card = {
      id: `en-de-${String(nextId).padStart(6, '0')}`,
      pair: 'en-de',
      sourceText: item.sourceText,
      targetText: item.targetText,
      altTargets: Array.isArray(rec.altTargets) ? rec.altTargets : [],
      cefr: rec.cefr,
      sentenceType: rec.sentenceType,
      tags: rec.tags,
      ipa: rec.ipa,
      source: 'tatoeba',
      sourceRef: `tatoeba:${item.toebaId}`,
      version: 1,
    };

    const { valid, errors } = validateCard(card);
    if (valid) {
      cards.push(card);
      nextId++;
    } else {
      rejected.push({ toebaId: item.toebaId, id: card.id, errors });
    }
  }

  const orphans = enrichment.filter(
    r => r && typeof r.toebaId === 'number' && !usedToebaIds.has(r.toebaId)
  );

  return { cards, skipped, rejected, orphans };
}

function main() {
  const rawPath = path.resolve('tools/corpus/raw/tatoeba-en-de.json');
  const enrichPath = path.resolve('tools/corpus/work/enrichment.jsonl');

  if (!fs.existsSync(rawPath)) {
    console.error('Raw input not found. Run `./tools/corpus/run_pipeline.sh fetch` first.');
    process.exit(1);
  }
  if (!fs.existsSync(enrichPath)) {
    console.error(
      'Enrichment input not found at tools/corpus/work/enrichment.jsonl.\n' +
      'Run the /corpus-enrich skill to produce it.'
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const enrichment = readJsonl(enrichPath);

  const { cards, skipped, rejected, orphans } = joinEnrichment(raw, enrichment);

  skipped.forEach(id => console.warn(`No enrichment for toebaId ${id} — skipped.`));
  orphans.forEach(r => console.warn(`Orphan enrichment (toebaId ${r.toebaId} has no raw match) — rejected.`));
  rejected.forEach(r => console.warn(`Rejected toebaId ${r.toebaId} (${r.id}): ${r.errors.join('; ')}`));

  const outPath = path.resolve('tools/corpus/enriched/en-de.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(cards, null, 2));

  console.log(`Enrichment complete. Wrote ${cards.length} valid cards.`);
  if (skipped.length) console.log(`Skipped ${skipped.length} raw items without enrichment.`);
  if (rejected.length) console.log(`Rejected ${rejected.length} cards with invalid output.`);
  if (orphans.length) console.log(`Rejected ${orphans.length} orphan enrichment lines.`);
}

if (process.env.NODE_ENV !== 'test') main();
