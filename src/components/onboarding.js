import { setPref, updateSessionState } from '../db/sqlite.js';
import { sync } from '../domain/sync.js';
import { hasGermanVoice } from '../domain/tts.js';

export default function onboarding() {
  return {
    step: 1,
    pair: 'en-de',
    level: 'A1',
    strategy: 'pure-srs',
    dailyLimit: 20,
    dailyLimitError: false,
    syncing: false,
    syncError: null,
    syncProgress: '',
    hasVoice: false,
    availableVoices: [],
    ttsVoice: '',

    async next() {
      if (this.step === 4) {
        if (this.dailyLimit < 5 || this.dailyLimit > 50) {
          this.dailyLimitError = true;
          return;
        }
        this.dailyLimitError = false;
        await this.performSync();
      } else if (this.step === 5) {
        if (this.syncError) return; // Wait for successful sync
        await this.checkTts();
        this.step++;
      } else if (this.step === 6) {
        await this.complete();
      } else {
        this.step++;
      }
    },

    selectPair(pair) {
      this.pair = pair;
    },
    
    selectLevel(level) {
      this.level = level;
    },

    selectStrategy(strategy) {
      this.strategy = strategy;
    },

    setDailyLimit(limit) {
      this.dailyLimit = limit;
      this.dailyLimitError = limit < 5 || limit > 50;
    },

    async performSync() {
      this.step = 5;
      this.syncing = true;
      this.syncError = null;
      
      const baseUrl = 'https://example.com'; 

      const result = await sync(this.pair, baseUrl, {
        onProgress: (stepName, current, total) => {
          this.syncProgress = `${stepName} ${current}/${total}`;
        }
      });

      this.syncing = false;
      if (!result.success) {
        this.syncError = result.error || 'Sync failed';
      }
    },

    async checkTts() {
      this.hasVoice = await hasGermanVoice();
      if (this.hasVoice && window.speechSynthesis) {
        this.availableVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('de'));
        if (this.availableVoices.length > 0) {
          this.ttsVoice = this.availableVoices[0].name;
        }
      } else {
        await setPref('tts_hint_shown', 'true');
      }
    },

    async complete() {
      await setPref('pair', this.pair);
      await setPref('current_level', this.level);
      await setPref('active_strategy', this.strategy);
      await updateSessionState({ active_strategy: this.strategy });
      await setPref('daily_new_limit', this.dailyLimit.toString());
      if (this.ttsVoice) {
        await setPref('tts_voice', this.ttsVoice);
      }
      await setPref('onboarding_complete', 'true');
      
      this.$dispatch('navigate', 'practice');
    }
  };
}
