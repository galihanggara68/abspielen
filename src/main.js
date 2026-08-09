import './style.css';
import Alpine from 'alpinejs';
import component from 'alpinejs-component';
import practice from './components/practice.js';
import app from './components/app.js';
import onboarding from './components/onboarding.js';
import settings from './components/settings.js';
import stats from './components/stats.js';
import credits from './components/credits.js';
import lastSession from './components/last-session.js';
import { initDb } from './db/sqlite.js';
import sessionStore from './stores/session.js';

window.Alpine = Alpine;
Alpine.plugin(component);

Alpine.store('session', sessionStore);

Alpine.data('app', app);
Alpine.data('practice', practice);
Alpine.data('onboarding', onboarding);
Alpine.data('settings', settings);
Alpine.data('stats', stats);
Alpine.data('credits', credits);
Alpine.data('lastSession', lastSession);

async function init() {
  try {
    await initDb();
    Alpine.start();
  } catch (err) {
    document.body.innerHTML = '<div style="padding: 20px; color: red;"><h1>Fatal Error</h1><p>' + err.message + '</p></div>';
    console.error('Fatal initialization error:', err);
  }
}

init();
