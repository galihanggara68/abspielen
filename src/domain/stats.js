import { getDueCards, getSessionState, getReviewLogs, countCardsByState } from '../db/sqlite.js';

export async function computeStats(now = Date.now()) {
  const dueCards = await getDueCards(now, 100000); // effectively Infinity
  const session = await getSessionState();
  
  const stateCounts = {
    new: await countCardsByState('new'),
    learning: await countCardsByState('learning'),
    review: await countCardsByState('review'),
    suspended: await countCardsByState('suspended')
  };

  const logsForRetention = await getReviewLogs(now - 7 * 24 * 60 * 60 * 1000);
  let retentionRate = 0;
  if (logsForRetention.length > 0) {
    let goodEasy = 0;
    logsForRetention.forEach(log => {
      if (log.grade === 'good' || log.grade === 'easy') goodEasy++;
    });
    retentionRate = Math.round((goodEasy / logsForRetention.length) * 100);
  }

  const allLogs = await getReviewLogs(0);
  let sessionStreak = 0;
  if (allLogs && allLogs.length > 0) {
    const days = new Set();
    allLogs.forEach(l => {
      const d = new Date(l.reviewed_at);
      d.setHours(0,0,0,0);
      days.add(d.getTime());
    });
    
    const sortedDays = Array.from(days).sort((a,b) => b - a);
    const today = new Date();
    today.setHours(0,0,0,0);
    let expectedTime = today.getTime();
    
    if (sortedDays[0] === expectedTime) {
      sessionStreak = 1;
      expectedTime -= 86400000;
      for (let i = 1; i < sortedDays.length; i++) {
        if (sortedDays[i] === expectedTime) {
          sessionStreak++;
          expectedTime -= 86400000;
        } else {
          break;
        }
      }
    } else if (sortedDays[0] === expectedTime - 86400000) {
      sessionStreak = 1;
      expectedTime -= 172800000;
      for (let i = 1; i < sortedDays.length; i++) {
        if (sortedDays[i] === expectedTime) {
          sessionStreak++;
          expectedTime -= 86400000;
        } else {
          break;
        }
      }
    }
  }

  return {
    cardsDueToday: dueCards.length,
    cardsSeenToday: session ? session.cards_seen_today : 0,
    newCardsToday: session ? session.new_cards_today : 0,
    sessionStreak,
    retentionRate,
    stateCounts
  };
}
