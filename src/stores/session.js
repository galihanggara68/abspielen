import { getSessionState, updateSessionState } from '../db/sqlite.js';

export default {
  cardsSeenToday: 0,
  newCardsToday: 0,
  strategy: 'pure-srs',
  dayResetAt: 0,

  async init() {
    const state = await getSessionState();
    if (state) {
      this.cardsSeenToday = state.cards_seen_today || 0;
      this.newCardsToday = state.new_cards_today || 0;
      this.strategy = state.active_strategy || 'pure-srs';
      this.dayResetAt = state.day_start_ts ? state.day_start_ts + 24 * 60 * 60 * 1000 : this._nextMidnight();
    } else {
      this.dayResetAt = this._nextMidnight();
    }
  },

  _nextMidnight() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  },

  async checkDayReset() {
    if (Date.now() >= this.dayResetAt) {
      this.cardsSeenToday = 0;
      this.newCardsToday = 0;
      this.dayResetAt = this._nextMidnight();
      await updateSessionState({
        cards_seen_today: 0,
        new_cards_today: 0,
        day_start_ts: Date.now()
      });
    }
  }
};
