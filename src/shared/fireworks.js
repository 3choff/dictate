const axios = require('axios');
const FormData = require('form-data');

// Transcribe audio using Fireworks audio transcription endpoint.
// Accepts a Buffer/Uint8Array and returns { text } or null on failure.
async function transcribeAudioFireworks(audioBuffer, apiKey, opts = {}) {
  if (!apiKey) {
    console.error('Fireworks API key is not configured.');
    return null;
  }
  try {
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'segment.wav' });
    form.append('vad_model', opts.vadModel || 'silero');
    form.append('alignment_model', opts.alignmentModel || 'tdnn_ffn');
    form.append('response_format', opts.responseFormat || 'json');
    form.append('preprocessing', opts.preprocessing || 'none');

    const temperature = opts.temperature;
    if (Array.isArray(temperature)) {
      form.append('temperature', temperature.join(','));
    } else if (typeof temperature === 'string') {
      form.append('temperature', temperature);
    } else {
      form.append('temperature', '0,0.2,0.4,0.6,0.8,1');
    }

    form.append('timestamp_granularities', opts.timestampGranularities || 'segment');

    const resp = await axios.post('https://audio-prod.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const data = resp && resp.data ? resp.data : null;
    if (!data) return null;
    if (typeof data.text === 'string' && data.text.trim()) return { text: data.text };
    if (Array.isArray(data.segments)) {
      const segment = data.segments.find((s) => typeof s.text === 'string' && s.text.trim().length > 0);
      if (segment) return { text: segment.text };
    }
    return null;
  } catch (error) {
    const detail = error && error.response ? error.response.data : error && error.message ? error.message : String(error);
    console.error('Fireworks transcription error:', detail);
    return null;
  }
}

// Rewrite text using Fireworks chat completions API with customizable prompt.
// Returns rewritten text string or null. Optional AbortSignal supported.
async function rewriteTextFireworks(text, prompt, apiKey, signal) {
  if (!apiKey) return null;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    console.warn('rewriteTextFireworks called without a prompt');
    return null;
  }
  try {
    const url = 'https://api.fireworks.ai/inference/v1/chat/completions';
    const body = {
      model: 'accounts/fireworks/models/gpt-oss-20b',
      max_tokens: 1024,
      top_p: 1,
      top_k: 40,
      presence_penalty: 0,
      frequency_penalty: 0,
      temperature: 0.6,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text },
      ],
      stream: false,
    };

    const resp = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal,
    });

    const choice = resp?.data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }
    return null;
  } catch (error) {
    const detail = error && error.response ? error.response.data : error && error.message ? error.message : String(error);
    console.error('Fireworks rewrite error:', detail);
    return null;
  }
}

module.exports = {
  transcribeAudioFireworks,
  rewriteTextFireworks,
};
