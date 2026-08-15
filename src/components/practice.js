import { getNextCard, gradeCard } from '../domain/scheduler.js';
import { hasGermanVoice, speak } from '../domain/tts.js';
import { getAllCards } from '../db/indexeddb.js';
import { countCardsByState, countDueCards, getSessionState, getPref } from '../db/sqlite.js';
import { Preferences } from '@capacitor/preferences';
import confetti from 'canvas-confetti';

export default function practice() {
  return {
    currentCard: null,
    revealed: false,
    cardsDue: 0,
    cardsSeenSession: 0,
    showIpa: false,
    audioFirstMode: false,
    clozeMode: false,
    maskedTargetText: '',
    hasTts: false,
    sessionDone: false,
    turnNote: '',
    newCardsSeenSession: 0,

    async handleNavigate(screen) {
      if (screen === 'practice') {
        this.sessionDone = false;
        this.cardsSeenSession = 0;
        this.newCardsSeenSession = 0;
        this.currentCard = null;
        await this.init();
      }
    },

    async init() {
      this.hasTts = await hasGermanVoice();
      this.audioFirstMode = (await getPref('audio_first_mode')) === 'true';
      this.clozeMode = (await getPref('cloze_mode')) === 'true';
      if (this.$store && this.$store.session) {
        await this.$store.session.init();
        if (this.cardsSeenSession === 0) {
          await this.$store.session.startNewSession();
        }
      }
      await this.pullNextCard();
    },

    async pullNextCard() {
      // Ensure daily reset check happens, even though we use session counts for the limit
      if (this.$store && this.$store.session) {
        await this.$store.session.checkDayReset();
      }
      
      const newCardLimit = parseInt(await getPref('daily_new_limit') || '20', 10);
      
      const nextState = await getNextCard({
        now: Date.now(),
        newCardLimit,
        newCardsSeenSession: this.newCardsSeenSession
      });

      if (!nextState) {
        this.currentCard = null;
        this.sessionDone = true;
        if (typeof document !== 'undefined') {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
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
      
      if (this.clozeMode && this.currentCard.targetText) {
        let targetWords = this.currentCard.targetText.split(' ');
        let candidateIndices = [];
        targetWords.forEach((word, index) => {
          if (word.replace(/[^a-zA-ZäöüÄÖÜß]/g, '').length >= 4) {
            candidateIndices.push(index);
          }
        });
        if (candidateIndices.length === 0) {
          candidateIndices = targetWords.map((_, i) => i);
        }
        
        let maskIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
        let wordToMask = targetWords[maskIndex];
        targetWords[maskIndex] = wordToMask.replace(/[a-zA-ZäöüÄÖÜß]+/g, '[?]');
        this.maskedTargetText = targetWords.join(' ');
      }
      
      const newCount = await countCardsByState('new');
      const dueCount = await countDueCards(Date.now());
      this.cardsDue = dueCount + Math.min(newCount, Math.max(0, newCardLimit - this.newCardsSeenSession));

      // Save to preferences for the Android widget
      const tag = this.currentCard.tags && this.currentCard.tags.length > 0 ? this.currentCard.tags[0] : '';
      const tagText = tag ? `[tag-run: ${tag}]` : '';
      await Preferences.set({ key: 'widget_card_source', value: this.currentCard.sourceText || '' });
      await Preferences.set({ key: 'widget_card_target', value: this.currentCard.targetText || '' });
      await Preferences.set({ key: 'widget_card_tag', value: tagText });
      await Preferences.set({ key: 'widget_cards_progress', value: `${this.cardsSeenSession}/${this.cardsDue + this.cardsSeenSession}` });
      
      // Notify the Android side to update widget
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
          try {
             const { Bridge } = window.Capacitor.Plugins;
          } catch (e) {}
      }
      
      if (this.audioFirstMode && this.hasTts && this.currentCard.targetText) {
        setTimeout(() => this.listen(), 100);
      }
    },

    reveal() {
      this.revealed = true;
    },

    async grade(gradeStr) {
      if (!this.currentCard) return;
      const isNew = this.currentCard.state === 'new';
      const sessionId = this.$store && this.$store.session ? this.$store.session.currentSessionId : '';
      await gradeCard(this.currentCard.id, gradeStr, this.turnNote, sessionId);
      this.turnNote = '';
      this.cardsSeenSession++;
      if (isNew) this.newCardsSeenSession++;
      
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
