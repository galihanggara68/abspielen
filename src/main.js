import './style.css';
import Alpine from 'alpinejs';
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

Alpine.store('session', sessionStore);

Alpine.data('app', app);
Alpine.data('practice', practice);
Alpine.data('onboarding', onboarding);
Alpine.data('settings', settings);
Alpine.data('stats', stats);
Alpine.data('credits', credits);
Alpine.data('lastSession', lastSession);

async function init() {
  await initDb();
  Alpine.start();
}

init();
