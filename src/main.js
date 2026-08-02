import './style.css';
import Alpine from 'alpinejs';
import practice from './components/practice.js';
import app from './components/app.js';
import onboarding from './components/onboarding.js';
import settings from './components/settings.js';
import stats from './components/stats.js';
import credits from './components/credits.js';
import { initDb } from './db/sqlite.js';

window.Alpine = Alpine;

Alpine.data('app', app);
Alpine.data('practice', practice);
Alpine.data('onboarding', onboarding);
Alpine.data('settings', settings);
Alpine.data('stats', stats);
Alpine.data('credits', credits);

async function init() {
  await initDb();
  Alpine.start();
}

init();
