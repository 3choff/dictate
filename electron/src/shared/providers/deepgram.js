const DG_BASE_WSS = 'wss://api.deepgram.com/v1/listen';

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
    model = 'nova-3',
    language = 'multi',
    punctuate = false,
    smart_format = false,
    interim_results = false,
    encoding,
    ...rest
  } = options || {};

  const qp = toQuery({ model, language, punctuate, smart_format, interim_results, encoding, ...rest });
  return qp ? `${DG_BASE_WSS}?${qp}` : DG_BASE_WSS;
}

function pickPreferredMime() {
  const preferred = 'audio/webm;codecs=opus';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(preferred)) {
    return { mimeType: preferred, encoding: 'opus' };
  }
  return { mimeType: undefined, encoding: undefined };
}

function createSocket(apiKey, url) {
  return new WebSocket(url, ['token', apiKey]);
}

function isFinalMessage(msg) {
  return msg && msg.type === 'Results' && (msg.is_final || msg.speech_final);
}

function extractTranscript(msg) {
  try {
    const alt = msg.channel && msg.channel.alternatives && msg.channel.alternatives[0];
    return alt && alt.transcript ? alt.transcript : '';
  } catch (_) {
    return '';
  }
}

const Deepgram = {
  buildUrl,
  pickPreferredMime,
  createSocket,
  isFinalMessage,
  extractTranscript,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Deepgram;
}

if (typeof window !== 'undefined') {
  window.Deepgram = Deepgram;
}
