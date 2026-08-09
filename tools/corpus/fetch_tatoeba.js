import fs from 'fs';
import path from 'path';

const API_BASE = 'https://tatoeba.org/en/api_v0/search?from=eng&to=deu&unapproved=no&word_count_min=4&word_count_max=12';

async function fetchPage(page) {
  const url = `${API_BASE}&page=${page}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
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
  
  const seenTargets = new Set();
  const results = [];
  let newCount = 0;

  // 1. Load existing from docs/chunks/
  const chunksDir = path.resolve('docs/chunks');
  if (fs.existsSync(chunksDir)) {
    const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const chunkData = JSON.parse(fs.readFileSync(path.join(chunksDir, file), 'utf-8'));
      for (const item of chunkData) {
        if (item.targetText) {
          seenTargets.add(item.targetText.toLowerCase().trim().replace(/\\s+/g, ' '));
        }
      }
    }
    console.log(`Loaded ${seenTargets.size} existing targets from docs/chunks`);
  }

  // 2. Load from raw/tatoeba-en-de.json if it exists
  const outPath = path.resolve('tools/corpus/raw/tatoeba-en-de.json');
  if (fs.existsSync(outPath)) {
    const existingRaw = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    for (const item of existingRaw) {
      const normalized = item.targetText.toLowerCase().trim().replace(/\\s+/g, ' ');
      seenTargets.add(normalized);
      results.push(item);
    }
    console.log(`Loaded ${results.length} existing pairs from raw JSON`);
  }

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
          newCount++;
        }
      }
    }

    console.log(`Fetched page ${page}, total unique pairs: ${results.length} (+${newCount} new)`);
    if (newCount >= TARGET_COUNT) break;

    // Small delay to prevent rate-limiting and connection drops
    await new Promise(r => setTimeout(r, 1000));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} total deduplicated pairs to ${outPath} (${newCount} newly added)`);
}

main().catch(console.error);
