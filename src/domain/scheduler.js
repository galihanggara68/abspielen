import { getDueCards, getNewCards, getSessionState, getCardState, upsertCardState, insertReviewLog, updateSessionState, getPref } from '../db/sqlite.js';
import { computeSm2 } from './sm2.js';
import { applyStrategy } from './strategies.js';
import { getAllChunkIds, getChunk } from '../db/indexeddb.js';

let pendingRunState = null;

export async function getNextCard({ now, newCardLimit, newCardsToday, currentLevel, recentFailedCardIds }) {
  const session = await getSessionState();
  
  const allDue = await getDueCards(now, 100);
  const newCards = await getNewCards(100);
  
  const availableNew = newCards.slice(0, Math.max(0, newCardLimit - newCardsToday));
  const candidateStates = [...allDue, ...availableNew];
  
  if (candidateStates.length === 0) return null;
  
  const chunkIds = await getAllChunkIds();
  const cardMap = new Map();
  for (const cid of chunkIds) {
    const chunk = await getChunk(cid);
    if (chunk && chunk.cards) {
      for (const c of chunk.cards) {
        cardMap.set(c.id, c);
      }
    }
  }
  
  const fullCards = candidateStates.map(st => {
    const full = cardMap.get(st.card_id) || {};
    return { ...full, ...st, id: st.card_id };
  });
  
  const newCardRatioPref = await getPref('new_card_ratio');
  const options = {
    new_card_ratio: newCardRatioPref ? parseInt(newCardRatioPref, 10) : 3,
    currentLevel,
    recentFailedCardIds
  };
  
  const { card, newRunKey, newRunCount } = applyStrategy(fullCards, session, options);
  
  if (card) {
    pendingRunState = { newRunKey, newRunCount };
    return card;
  }
  return null;
}

export async function gradeCard(cardId, grade) {
  const now = Date.now();
  const cardState = await getCardState(cardId);
  if (!cardState) return;
  
  const prevState = { ...cardState };
  const nextState = computeSm2(cardState, grade);
  
  await upsertCardState({
    ...prevState,
    ease: nextState.ease,
    interval_days: nextState.interval_days,
    repetitions: nextState.repetitions,
    state: nextState.state,
    last_reviewed_at: now,
    due_at: nextState.interval_days === 0 ? null : now + nextState.interval_days * 24 * 60 * 60 * 1000
  });
  
  await insertReviewLog({
    card_id: cardId,
    reviewed_at: now,
    grade,
    prev_ease: prevState.ease,
    prev_interval: prevState.interval_days,
    prev_reps: prevState.repetitions,
    new_ease: nextState.ease,
    new_interval: nextState.interval_days,
    new_reps: nextState.repetitions
  });
  
  const session = await getSessionState();
  if (session) {
    const isNew = prevState.state === 'new';
    const updates = {
      cards_seen_today: session.cards_seen_today + 1,
      new_cards_today: isNew ? session.new_cards_today + 1 : session.new_cards_today
    };
    if (pendingRunState) {
      if (pendingRunState.newRunKey !== undefined) updates.current_run_key = pendingRunState.newRunKey;
      if (pendingRunState.newRunCount !== undefined) updates.current_run_count = pendingRunState.newRunCount;
      pendingRunState = null;
    }
    await updateSessionState(updates);
  }
}
