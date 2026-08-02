import { getDueCards, getNewCards, getSessionState, getCardState, upsertCardState, insertReviewLog, updateSessionState } from '../db/sqlite.js';
import { computeSm2 } from './sm2.js';

export async function getNextCard({ now, newCardLimit, newCardsToday }) {
  const session = await getSessionState();
  const cardsSeenToday = session ? session.cards_seen_today : 0;
  
  const allDue = await getDueCards(now, 100);
  const reviews = allDue.filter(c => c.state !== 'new');
  
  const newCards = await getNewCards(1);
  const hasReviews = reviews.length > 0;
  const hasNew = newCards.length > 0 && newCardsToday < newCardLimit;
  
  if (!hasReviews && !hasNew) return null;
  
  const isNewSlot = (cardsSeenToday % 4 === 3);
  
  let selectedCardState = null;
  if (hasNew && (!hasReviews || isNewSlot)) {
    selectedCardState = newCards[0];
  } else {
    selectedCardState = reviews[0];
  }
  
  return {
    ...selectedCardState,
    id: selectedCardState.card_id
  };
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
    await updateSessionState({
      cards_seen_today: session.cards_seen_today + 1,
      new_cards_today: isNew ? session.new_cards_today + 1 : session.new_cards_today
    });
  }
}
