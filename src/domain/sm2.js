export function computeSm2(cardState, grade) {
  let { ease = 2.5, interval_days = 0, repetitions = 0, state = 'new' } = cardState;
  
  const qMap = { again: 2, hard: 3, good: 4, easy: 5 };
  const q = qMap[grade] !== undefined ? qMap[grade] : 4;

  if (q < 3) {
    repetitions = 0;
    interval_days = 0;
    state = 'learning';
  } else {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      let rawInterval = Math.round(interval_days * ease);
      if (rawInterval >= 4) {
        const fuzzFactor = 0.10;
        const maxFuzz = Math.max(1, Math.round(rawInterval * fuzzFactor));
        const fuzz = Math.floor(Math.random() * (maxFuzz * 2 + 1)) - maxFuzz;
        interval_days = rawInterval + fuzz;
      } else {
        interval_days = rawInterval;
      }
    }
    repetitions += 1;
    
    if (state === 'new') {
      state = 'learning';
    }
    if (state === 'learning' && interval_days >= 1) {
      state = 'review';
    }
  }

  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ease = Math.max(1.3, ease);

  return { ease, interval_days, repetitions, state };
}
