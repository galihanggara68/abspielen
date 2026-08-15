# Abspielen

A lightweight, offline-first hybrid Android flashcard app for language learners. Designed to turn idle moments into spaced language practice using curated, real-world sentences.

## Features

- **Curated, real-world sentences**: Uses a Tatoeba seed along with AI enrichment and human review for high-quality language learning.
- **Thematic session shaping**: Practice in coherent runs by topic, sentence type, or with deliberate difficulty spikes, layered on top of an SM-2 spaced repetition scheduler.
- **Self-grade honesty loop**: No speech recognition or gamification fluff; the user evaluates their own retention.
- **Offline-First**: Uses IndexedDB for chunk caching and SQLite for spaced repetition state (SM-2) and logs.
- **TTS playback**: Includes target sentence pronunciation using Web SpeechSynthesis API.
- **Phonetic guidance**: Displays precomputed IPA transcriptions alongside the target text.
- **Focus on English ↔ German**: Current version focuses on en-de practice for CEFR levels A1, A2, B1, B2.

## Tech Stack

- **Frameworks**: Vite 8, Alpine.js 3, Capacitor 8 (Android)
- **Data & Storage**:
  - Capacitor SQLite (`@capacitor-community/sqlite`)
  - IndexedDB (`idb` wrapper) for caching
- **Package Manager**: pnpm

## Architecture

Abspielen is a hybrid app consisting of an Alpine.js web frontend packaged inside a Capacitor shell for Android.

```text
+------------------------------------------+
|              Main app (webview)          |
|  Alpine.js UI <---> Domain logic         |
|       |                 |                |
|   IndexedDB         SQLite               |
|   (chunk cache)    (SRS state, logs)     |
+------------------------------------------+
              |
        Capacitor runtime
              |
        Android (native shell)
```

The app synchronizes content blocks (chunks) via GitHub Pages as brotli-precompressed JSON files.

## Project Layout

- `src/`: Application source code (Alpine components, stores, database wrappers, domain logic).
- `tools/`: Offline pipeline tools (Node) for corpus enrichment, tag taxonomy, and chunk generation.
- `public/`: Static assets.
- `android/`: Native Android Capacitor project.
- `docs/`: Chunks and manifests (served over a static host).

## Development Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm run dev
   ```
3. Run tests:
   ```bash
   pnpm run test
   ```
4. Build the web dist for production:
   ```bash
   pnpm run build
   ```

## License

ISC License
