import { getReviewLogsBySession, getPref } from '../db/sqlite.js';
import { getAllCards } from '../db/indexeddb.js';
import { hasGermanVoice, speak } from '../domain/tts.js';

export default function lastSession() {
  return {
    turns: [],
    hasTts: false,

    async init() {
      this.hasTts = await hasGermanVoice();
      let sessionId = null;
      if (this.$store && this.$store.session) {
        await this.$store.session.init();
        sessionId = this.$store.session.currentSessionId;
      }
      
      if (!sessionId) {
        this.turns = [];
        return;
      }

      const logs = await getReviewLogsBySession(sessionId);
      if (logs.length === 0) {
        this.turns = [];
        return;
      }

      const pair = await getPref('pair') || 'en-de';
      const allCards = await getAllCards(pair);
      
      this.turns = logs.map(log => {
        const cardData = allCards.find(c => c.id === log.card_id) || {};
        return {
          id: log.id,
          card_id: log.card_id,
          grade: log.grade,
          note: log.note,
          reviewed_at: log.reviewed_at,
          sourceText: cardData.sourceText || '',
          targetText: cardData.targetText || '',
          ipa: cardData.ipa || ''
        };
      });
    },

    listen(text) {
      if (text) {
        speak(text, 'de');
      }
    }
  };
}
