(function (global) {
  const LANGUAGE_CODES = {
    multilingual: { whisper: undefined, deepgram: 'multi' },
    en: { whisper: 'en', deepgram: 'en' },
    it: { whisper: 'it', deepgram: 'it' },
    es: { whisper: 'es', deepgram: 'es' },
    fr: { whisper: 'fr', deepgram: 'fr' },
    de: { whisper: 'de', deepgram: 'de' },
    pt: { whisper: 'pt', deepgram: 'pt' },
    ja: { whisper: 'ja', deepgram: 'ja' },
    nl: { whisper: 'nl', deepgram: 'nl' },
  };

  function normalizeSelection(selection) {
    return typeof selection === 'string' && selection.trim()
      ? selection.trim().toLowerCase()
      : 'multilingual';
  }

  function getWhisperLanguage(selection) {
    const key = normalizeSelection(selection);
    const entry = LANGUAGE_CODES[key];
    return entry ? entry.whisper : undefined;
  }

  function getDeepgramLanguage(selection) {
    const key = normalizeSelection(selection);
    const entry = LANGUAGE_CODES[key];
    return (entry && entry.deepgram) || 'multi';
  }

  const LanguageMap = {
    LANGUAGE_CODES,
    getWhisperLanguage,
    getDeepgramLanguage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LanguageMap;
  } else {
    global.LanguageMap = LanguageMap;
  }
})(typeof window !== 'undefined' ? window : this);
