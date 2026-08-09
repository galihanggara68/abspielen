import { TextToSpeech } from '@capacitor-community/text-to-speech';

export async function hasGermanVoice() {
  try {
    const { supported } = await TextToSpeech.isLanguageSupported({ lang: 'de-DE' });
    if (supported) return true;
    
    // Fallback: check all supported languages to see if 'de' is there
    const { languages } = await TextToSpeech.getSupportedLanguages();
    return languages.some(l => l.startsWith('de'));
  } catch (e) {
    console.error("Failed to check TTS support", e);
    return false;
  }
}

export async function speak(text, lang) {
  try {
    const targetLang = lang.startsWith('de') ? 'de-DE' : lang;
    await TextToSpeech.speak({
      text,
      lang: targetLang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    });
  } catch (e) {
    console.error("TTS speak failed", e);
  }
}
