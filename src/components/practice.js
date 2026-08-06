import { getNextCard, gradeCard } from '../domain/scheduler.js';
import { hasGermanVoice, speak } from '../domain/tts.js';
import { getAllCards } from '../db/indexeddb.js';
import { countCardsByState, getSessionState, getPref } from '../db/sqlite.js';
import { Preferences } from '@capacitor/preferences';

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

      const pair = await getPref('pair') || 'en-de';
      const allCards = await getAllCards(pair);
      const cardData = allCards.find(c => c.id === nextState.card_id) || {};
      
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

      // Save to preferences for the Android widget
      const tag = this.currentCard.tags && this.currentCard.tags.length > 0 ? this.currentCard.tags[0] : '';
      const tagText = tag ? `[tag-run: ${tag}]` : '';
      await Preferences.set({ key: 'widget_card_source', value: this.currentCard.sourceText || '' });
      await Preferences.set({ key: 'widget_card_target', value: this.currentCard.targetText || '' });
      await Preferences.set({ key: 'widget_card_tag', value: tagText });
      await Preferences.set({ key: 'widget_cards_progress', value: `${this.cardsSeenSession}/${this.cardsDue + this.cardsSeenSession}` });
      
      // Notify the Android side to update widget
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
          try {
             const { Bridge } = window.Capacitor.Plugins;
             // We can use an intent to notify the widget, or just send a broadcast.
             // But actually, we need to create a custom plugin or we can just run evaluateJS if we had a plugin...
             // Wait, there is no direct way to send broadcast from Capacitor JS without a plugin.
             // But the widget updates every 30 mins automatically if we use AppWidgetProvider or when app closes.
          } catch (e) {}
      }
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
