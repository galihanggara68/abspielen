import fixtures from '../data/fixtures.json';
import { putChunk } from './indexeddb.js';
import { seedNewCards } from './sqlite.js';

export async function loadFixtures() {
  await putChunk(fixtures);
  const cardIds = fixtures.cards.map(c => c.id);
  await seedNewCards(cardIds);
}
