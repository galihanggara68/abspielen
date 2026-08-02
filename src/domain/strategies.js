export function pureSrsPick(cards, sessionState, options) {
  const reviews = cards.filter(c => c.state !== 'new').sort((a, b) => (a.due_at || 0) - (b.due_at || 0));
  const newCards = cards.filter(c => c.state === 'new');
  
  const ratio = options?.new_card_ratio !== undefined ? options.new_card_ratio : 3;
  const cardsSeen = sessionState?.cards_seen_today || 0;
  
  const isNewSlot = ratio > 0 ? (cardsSeen % (ratio + 1) === ratio) : false;
  
  if (isNewSlot && newCards.length > 0) return newCards[0];
  if (reviews.length > 0) return reviews[0];
  if (newCards.length > 0) return newCards[0];
  
  return null;
}

export function applyStrategy(cards, sessionState, options = {}) {
  if (!cards || cards.length === 0) return { card: null, newRunKey: null, newRunCount: 0 };

  const strategy = sessionState?.active_strategy || 'pure-srs';
  let runKey = sessionState?.current_run_key || null;
  let runCount = sessionState?.current_run_count || 0;

  if (strategy === 'pure-srs') {
    const card = pureSrsPick(cards, sessionState, options);
    return { card, newRunKey: null, newRunCount: 0 };
  }

  if (strategy === 'tag-run') {
    let matchingCards = runKey ? cards.filter(c => c.tags && c.tags.includes(runKey)) : [];
    
    if (runCount >= 5 || !runKey || matchingCards.length === 0) {
      const counts = {};
      for (const c of cards) {
        if (!c.tags) continue;
        for (const t of c.tags) {
          if (t !== runKey) counts[t] = (counts[t] || 0) + 1;
        }
      }
      const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      if (tags.length > 0) {
        runKey = tags[0];
        runCount = 0;
        matchingCards = cards.filter(c => c.tags && c.tags.includes(runKey));
      } else {
        runKey = null;
        runCount = 0;
        matchingCards = [];
      }
    }

    if (matchingCards.length > 0) {
      const card = pureSrsPick(matchingCards, sessionState, options);
      return { card, newRunKey: runKey, newRunCount: runCount + 1 };
    } else {
      const card = pureSrsPick(cards, sessionState, options);
      return { card, newRunKey: runKey, newRunCount: runCount }; 
    }
  }

  if (strategy === 'type-run') {
    let matchingCards = runKey ? cards.filter(c => c.sentenceType === runKey) : [];

    if (runCount >= 2 || !runKey || matchingCards.length === 0) {
      const counts = {};
      for (const c of cards) {
        if (!c.sentenceType) continue;
        const t = c.sentenceType;
        if (t !== runKey) counts[t] = (counts[t] || 0) + 1;
      }
      const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      if (types.length > 0) {
        runKey = types[0];
        runCount = 0;
        matchingCards = cards.filter(c => c.sentenceType === runKey);
      } else {
        runKey = null;
        runCount = 0;
        matchingCards = [];
      }
    }

    if (matchingCards.length > 0) {
      const card = pureSrsPick(matchingCards, sessionState, options);
      return { card, newRunKey: runKey, newRunCount: runCount + 1 };
    } else {
      const card = pureSrsPick(cards, sessionState, options);
      return { card, newRunKey: runKey, newRunCount: runCount };
    }
  }

  if (strategy === 'difficulty-injection') {
    const currentLevel = options.currentLevel || 'A1';
    runKey = currentLevel;
    
    if (runCount >= 5) {
      let harderLevel = null;
      if (currentLevel === 'A1') harderLevel = 'A2';
      else if (currentLevel === 'A2') harderLevel = 'B1';
      else if (currentLevel === 'B1') harderLevel = 'B2';
      
      let spikeCard = null;
      
      if (harderLevel) {
        const matching = cards.filter(c => c.cefr === harderLevel);
        spikeCard = pureSrsPick(matching, sessionState, options);
      } else if (currentLevel === 'B2') {
        const recentFailed = options.recentFailedCardIds || [];
        for (const id of recentFailed) {
          const c = cards.find(x => x.id === id);
          if (c) {
            spikeCard = c;
            break;
          }
        }
      }
      
      if (spikeCard) {
        return { card: spikeCard, newRunKey: runKey, newRunCount: 0 };
      } else {
        const matching = cards.filter(c => c.cefr === currentLevel);
        const card = pureSrsPick(matching.length > 0 ? matching : cards, sessionState, options);
        return { card, newRunKey: runKey, newRunCount: 0 };
      }
    } else {
      const matching = cards.filter(c => c.cefr === currentLevel);
      if (matching.length > 0) {
        const card = pureSrsPick(matching, sessionState, options);
        return { card, newRunKey: runKey, newRunCount: runCount + 1 };
      } else {
        const card = pureSrsPick(cards, sessionState, options);
        return { card, newRunKey: runKey, newRunCount: runCount + 1 };
      }
    }
  }

  const card = pureSrsPick(cards, sessionState, options);
  return { card, newRunKey: null, newRunCount: 0 };
}

export function resetRun(sessionState) {
  return {
    ...sessionState,
    current_run_key: null,
    current_run_count: 0
  };
}
