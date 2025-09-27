const CT_BASE_WSS = 'wss://api.cartesia.ai/stt/websocket';
const CT_VERSION = '2025-04-16';

function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    search.set(k, String(v));
  });
  return search.toString();
}

function buildUrl(options) {
  const {
    apiKey,                 // required in browser via query
    model = 'ink-whisper',  // default model
    encoding = 'pcm_s16le', // required
    sample_rate = 16000,    // required
    language,               // optional; omit for multilingual (Cartesia defaults to en)
    cartesia_version = CT_VERSION,
  } = options || {};

  const qp = toQuery({
    model,
    encoding,
    sample_rate,
    api_key: apiKey,
    cartesia_version,
    language,
  });
  return qp ? `${CT_BASE_WSS}?${qp}` : CT_BASE_WSS;
}

function createSocket(url) {
  // Browser cannot set headers; all auth/version must be in the URL
  return new WebSocket(url);
}

function isFinalMessage(msg) {
  return msg && msg.type === 'transcript' && !!msg.is_final;
}

function extractTranscript(msg) {
  try {
    const t = (msg && msg.text) ? String(msg.text).trim() : '';
    return t;
  } catch (_) {
    return '';
  }
}

const Cartesia = {
  buildUrl,
  createSocket,
  isFinalMessage,
  extractTranscript,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Cartesia;
}

if (typeof window !== 'undefined') {
  window.Cartesia = Cartesia;
}
