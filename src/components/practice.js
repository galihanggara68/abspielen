import { loadFixtures } from '../db/seed.js';
import { getNextCard, gradeCard } from '../domain/scheduler.js';
import { hasGermanVoice, speak } from '../domain/tts.js';
import { getChunk } from '../db/indexeddb.js';
import { countCardsByState, getSessionState, getPref } from '../db/sqlite.js';

export default function practice() {
  return {
    currentCard: null,
    revealed: false,
    cardsDue: 0,
    cardsSeenSession: 0,
    showIpa: false,
    hasTts: false,
    sessionDone: false,

    async init() {
      await loadFixtures();
      this.hasTts = await hasGermanVoice();
      if (this.$store && this.$store.session) {
        await this.$store.session.init();
      }
      await this.pullNextCard();
    },

    async pullNextCard() {
      let newCardsToday = 0;
      if (this.$store && this.$store.session) {
        await this.$store.session.checkDayReset();
        newCardsToday = this.$store.session.newCardsToday;
      } else {
        const session = await getSessionState();
        if (session) newCardsToday = session.new_cards_today;
      }
      
      const newCardLimit = parseInt(await getPref('daily_new_limit') || '20', 10);
      
      const nextState = await getNextCard({
        now: Date.now(),
        newCardLimit,
        newCardsToday
      });

      if (!nextState) {
        this.sessionDone = true;
        this.currentCard = null;
        return;
      }

      const chunk = await getChunk('fixtures-dev-001');
      const cardData = chunk ? chunk.cards.find(c => c.id === nextState.card_id) : {};
      
      this.currentCard = {
        ...cardData,
        ...nextState,
        id: nextState.card_id
      };
      
      this.revealed = false;
      this.showIpa = false;
      
      const newCount = await countCardsByState('new');
      const reviewCount = await countCardsByState('review');
      const learningCount = await countCardsByState('learning');
      this.cardsDue = reviewCount + learningCount + Math.min(newCount, newCardLimit - newCardsToday);
    },

    reveal() {
      this.revealed = true;
    },

    async grade(gradeStr) {
      if (!this.currentCard) return;
      await gradeCard(this.currentCard.id, gradeStr);
      this.cardsSeenSession++;
      
      const session = await getSessionState();
      if (session && this.$store && this.$store.session) {
        this.$store.session.cardsSeenToday = session.cards_seen_today;
        this.$store.session.newCardsToday = session.new_cards_today;
      }
      
      await this.pullNextCard();
    },

    toggleIpa() {
      this.showIpa = !this.showIpa;
    },

    listen() {
      if (this.currentCard && this.currentCard.targetText) {
        speak(this.currentCard.targetText, 'de');
      }
    }
  };
}
