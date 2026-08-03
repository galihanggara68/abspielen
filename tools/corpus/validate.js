import { VALID_TAGS, VALID_CEFR, VALID_SENTENCE_TYPES, VALID_SOURCES } from './taxonomy.js';

// Shared card validator. Returns { valid, errors } instead of throwing so
// callers (enrich.js, merge_gapfill.js) can collect rejections and continue.
// emit_chunks.js wraps this in validateAndEmit() which throws on the first
// invalid card, preserving its prior behavior.
export function validateCard(card) {
  const errors = [];
  const id = card && card.id != null ? card.id : '<no-id>';

  if (!card || typeof card !== 'object') {
    return { valid: false, errors: ['card is not an object'] };
  }
  if (!/^en-de-\d{6}$/.test(card.id || '')) errors.push(`Invalid ID: ${card.id}`);
  if (card.pair !== 'en-de') errors.push(`Invalid pair: ${card.pair} for ${id}`);
  if (typeof card.sourceText !== 'string' || card.sourceText.trim() === '') errors.push(`Invalid sourceText for ${id}`);
  if (typeof card.targetText !== 'string' || card.targetText.trim() === '') errors.push(`Invalid targetText for ${id}`);
  if (!Array.isArray(card.altTargets) || card.altTargets.length > 2) {
    errors.push(`Invalid altTargets for ${id}`);
  } else {
    card.altTargets.forEach(a => {
      if (typeof a !== 'string' || a.trim() === '') errors.push(`Empty altTarget in ${id}`);
    });
  }
  if (!VALID_CEFR.includes(card.cefr)) errors.push(`Invalid CEFR: ${card.cefr} for ${id}`);
  if (!VALID_SENTENCE_TYPES.includes(card.sentenceType)) errors.push(`Invalid sentenceType: ${card.sentenceType} for ${id}`);
  if (!Array.isArray(card.tags) || card.tags.length < 1 || card.tags.length > 3) {
    errors.push(`Invalid tags array for ${id}`);
  } else {
    card.tags.forEach(t => {
      if (!VALID_TAGS.includes(t)) errors.push(`invalid tag: ${t} for ${id}`);
    });
  }
  if (typeof card.ipa !== 'string' || card.ipa.trim() === '') errors.push(`Invalid ipa for ${id}`);
  if (!VALID_SOURCES.includes(card.source)) errors.push(`Invalid source: ${card.source} for ${id}`);
  if (typeof card.version !== 'number' || card.version < 1) errors.push(`Invalid version for ${id}`);

  return { valid: errors.length === 0, errors };
}
