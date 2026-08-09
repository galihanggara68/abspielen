import { getPref, setPref, updateSessionState, resetAllProgress } from '../db/sqlite.js';
import { checkForUpdates, sync } from '../domain/sync.js';
import { hasGermanVoice } from '../domain/tts.js';

export default function settings() {
  return {
    pair: 'en-de',
    currentLevel: 'A1',
    activeStrategy: 'pure-srs',
    dailyLimit: 20,
    ttsVoice: '',
    showIpa: false,
    audioFirstMode: false,
    clozeMode: false,
    darkMode: false,
    voices: [],
    syncing: false,
    syncResult: '',
    
    async init() {
      this.pair = await getPref('pair') || 'en-de';
      this.currentLevel = await getPref('current_level') || 'A1';
      this.activeStrategy = await getPref('active_strategy') || 'pure-srs';
      this.dailyLimit = parseInt(await getPref('daily_new_limit') || '20', 10);
      this.ttsVoice = await getPref('tts_voice') || '';
      this.showIpa = (await getPref('show_ipa')) === 'true';
      this.audioFirstMode = (await getPref('audio_first_mode')) === 'true';
      this.clozeMode = (await getPref('cloze_mode')) === 'true';
      this.darkMode = (await getPref('dark_mode')) === 'true';
      
      if (await hasGermanVoice() && window.speechSynthesis) {
        this.voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('de'));
      }
    },
    
    async saveLevel(val) {
      this.currentLevel = val;
      await setPref('current_level', val);
    },

    async changeStrategy(val) {
      this.activeStrategy = val;
      await setPref('active_strategy', val);
      await updateSessionState({ active_strategy: val, current_run_key: null, current_run_count: 0 });
    },
    
    async saveDailyLimit(val) {
      this.dailyLimit = val;
      await setPref('daily_new_limit', val.toString());
    },
    
    async saveVoice(val) {
      this.ttsVoice = val;
      await setPref('tts_voice', val);
    },
    
    async toggleIpa() {
      this.showIpa = !this.showIpa;
      await setPref('show_ipa', this.showIpa.toString());
    },
    
    async toggleAudioFirstMode() {
      this.audioFirstMode = !this.audioFirstMode;
      await setPref('audio_first_mode', this.audioFirstMode.toString());
    },
    
    async toggleClozeMode() {
      this.clozeMode = !this.clozeMode;
      await setPref('cloze_mode', this.clozeMode.toString());
    },
    
    async toggleDarkMode() {
      this.darkMode = !this.darkMode;
      await setPref('dark_mode', this.darkMode.toString());
      this.$dispatch('toggle-dark-mode');
    },

    async checkUpdates() {
      this.syncing = true;
      this.syncResult = 'Checking...';
      try {
        const baseUrl = import.meta.env.VITE_BASE_URL || 'https://example.com';
        const res = await checkForUpdates(this.pair, baseUrl);
        if (res.updateAvailable) {
          this.syncResult = 'Updating...';
          const syncRes = await sync(this.pair, baseUrl);
          this.syncResult = syncRes.success ? 'Updated!' : 'Update failed';
        } else {
          this.syncResult = 'Up to date';
        }
      } catch (err) {
        this.syncResult = 'Error checking updates';
      }
      this.syncing = false;
    },

    async resetProgress() {
      if (confirm('Are you sure you want to reset all your learning progress? This cannot be undone.')) {
        await resetAllProgress();
        this.syncResult = 'Progress reset.';
      }
    }
  };
}
