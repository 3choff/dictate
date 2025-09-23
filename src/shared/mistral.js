const axios = require('axios');
const FormData = require('form-data');

// Transcribe audio using Mistral's audio transcriptions endpoint.
// Accepts a Buffer/Uint8Array of WAV bytes and returns { text } or null on failure.
async function transcribeAudioMistral(audioBuffer, apiKey, opts = {}) {
  if (!apiKey) {
    console.error('Mistral API key is not configured.');
    return null;
  }
  try {
    const form = new FormData();
    const model = opts.model || 'voxtral-mini-2507';
    form.append('file', audioBuffer, { filename: 'segment.wav' });
    form.append('model', model);
    if (opts.language) form.append('language', opts.language);

    const resp = await axios.post('https://api.mistral.ai/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': apiKey,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const data = resp && resp.data ? resp.data : null;
    if (!data) return null;
    if (typeof data.text === 'string') return { text: data.text };
    // Fallback: if API returns a different structure, try common fields
    if (data.results && data.results[0] && typeof data.results[0].text === 'string') {
      return { text: data.results[0].text };
    }
    return null;
  } catch (error) {
    const detail = error && error.response ? error.response.data : error && error.message ? error.message : String(error);
    console.error('Mistral transcription error:', detail);
    return null;
  }
}

module.exports = {
  transcribeAudioMistral,
};
