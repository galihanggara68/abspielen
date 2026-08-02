import { getPref, setPref } from '../db/sqlite.js';

export default function app() {
  return {
    currentScreen: '', // 'onboarding', 'practice', 'settings', 'stats', 'credits'
    darkMode: false,

    async init() {
      const darkModePref = await getPref('dark_mode');
      if (darkModePref !== null) {
        this.darkMode = darkModePref === 'true';
      } else {
        this.darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      this.applyTheme();

      const onboardingComplete = await getPref('onboarding_complete');
      if (onboardingComplete === 'true') {
        this.currentScreen = 'practice';
      } else {
        this.currentScreen = 'onboarding';
      }
    },

    navigate(screen) {
      this.currentScreen = screen;
    },

    async toggleDarkMode() {
      this.darkMode = !this.darkMode;
      await setPref('dark_mode', this.darkMode.toString());
      this.applyTheme();
    },

    applyTheme() {
      if (this.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };
}
