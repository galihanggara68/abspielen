import fs from 'fs';
import path from 'path';

const API_BASE = 'https://tatoeba.org/en/api_v0/search?from=eng&to=deu&unapproved=no';

async function fetchPage(page) {
  const url = `${API_BASE}&page=${page}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`Error fetching page ${page}:`, err);
    return [];
  }
}

async function main() {
  const TARGET_COUNT = 300; // Need >= 200 after deduplication
  const MAX_PAGES = 100;
  
  let rawPairs = [];
  const seenTargets = new Set();
  const results = [];

  console.log('Fetching from Tatoeba API...');
  // Fetch pages sequentially to avoid hammering the API too hard, or use small batches
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageResults = await fetchPage(page);
    if (pageResults.length === 0) break;

    for (const item of pageResults) {
      if (!item.translations || !item.translations[0] || item.translations[0].length === 0) continue;
      
      const sourceText = item.text;
      const toebaId = item.id;
      
      for (const translation of item.translations[0]) {
        const targetText = translation.text;
        if (!sourceText || !targetText) continue;

        const normalized = targetText.toLowerCase().trim().replace(/\s+/g, ' ');
        if (!seenTargets.has(normalized)) {
          seenTargets.add(normalized);
          results.push({ sourceText, targetText, toebaId });
        }
      }
    }

    console.log(`Fetched page ${page}, total unique pairs: ${results.length}`);
    if (results.length >= TARGET_COUNT) break;
  }

  const outPath = path.resolve('tools/corpus/raw/tatoeba-en-de.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} deduplicated pairs to ${outPath}`);
}

main().catch(console.error);
