import { getPref, setPref } from '../db/sqlite.js';

export default function app() {
  return {
    currentScreen: '', // 'onboarding', 'practice', 'settings', 'stats', 'credits'
    darkMode: false,
    globalErrors: [],

    async init() {
      // Catch standard errors
      window.addEventListener('error', (event) => {
        event.preventDefault();
        this.logError(event.message || 'Unknown Error', event.error?.stack || 'No stack trace available');
      });

      // Catch unhandled promises
      window.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        this.logError(event.reason?.message || 'Unhandled Promise Rejection', event.reason?.stack || String(event.reason));
      });

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
    },

    logError(summary, details) {
      console.error(summary, details);
      this.globalErrors.push({ id: Date.now() + Math.random(), summary, details, expanded: false });
    },

    dismissError(id) {
      this.globalErrors = this.globalErrors.filter(e => e.id !== id);
    }
  };
}
