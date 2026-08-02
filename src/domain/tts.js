export async function hasGermanVoice() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : globalThis.speechSynthesis;
  if (!synth) return false;
  
  const voices = synth.getVoices();
  if (voices.length > 0) {
    return voices.some(v => v.lang.startsWith('de'));
  }
  
  return new Promise((resolve) => {
    const handleVoicesChanged = () => {
      const v = synth.getVoices();
      resolve(v.some(voice => voice.lang.startsWith('de')));
      synth.removeEventListener('voiceschanged', handleVoicesChanged);
    };
    if (synth.addEventListener) {
      synth.addEventListener('voiceschanged', handleVoicesChanged);
    } else {
      resolve(false);
      return;
    }
    // Timeout fallback just in case
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(synth.getVoices().some(voice => voice.lang.startsWith('de')));
    }, 500);
  });
}

export function speak(text, lang) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : globalThis.speechSynthesis;
  if (!synth) return;
  const voices = synth.getVoices();
  const voice = voices.find(v => v.lang.startsWith(lang));
  if (!voice) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  synth.speak(utterance);
}
