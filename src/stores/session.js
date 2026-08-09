import { getSessionState, updateSessionState } from '../db/sqlite.js';

export default {
  cardsSeenToday: 0,
  newCardsToday: 0,
  strategy: 'pure-srs',
  dayResetAt: 0,
  currentSessionId: null,
  currentStreak: 0,
  lastStudyDate: null,

  async init() {
    const state = await getSessionState();
    if (state) {
      this.cardsSeenToday = state.cards_seen_today || 0;
      this.newCardsToday = state.new_cards_today || 0;
      this.strategy = state.active_strategy || 'pure-srs';
      this.currentSessionId = state.current_session_id || null;
      this.currentStreak = state.current_streak || 0;
      this.lastStudyDate = state.last_study_date || null;
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

  async startNewSession() {
    this.currentSessionId = Date.now().toString();

    const todayStr = new Date().toISOString().split('T')[0];
    let newStreak = this.currentStreak || 0;
    if (this.lastStudyDate !== todayStr) {
       const yesterday = new Date(Date.now() - 86400000);
       const yesterdayStr = yesterday.toISOString().split('T')[0];
       if (this.lastStudyDate === yesterdayStr) {
          newStreak += 1;
       } else {
          newStreak = 1;
       }
       this.lastStudyDate = todayStr;
       this.currentStreak = newStreak;
    }

    await updateSessionState({ 
      current_session_id: this.currentSessionId,
      current_streak: this.currentStreak,
      last_study_date: this.lastStudyDate
    });
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
