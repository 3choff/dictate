const axios = require('axios');
const FormData = require('form-data');

// Transcribe audio using SambaNova Whisper endpoint.
// Accepts a Buffer/Uint8Array of audio bytes and returns { text } or null on failure.
async function transcribeAudioSambaNova(audioBuffer, apiKey, opts = {}) {
  if (!apiKey) {
    console.error('SambaNova API key is not configured.');
    return null;
  }
  try {
    const language = opts.language;
    const responseFormat = opts.responseFormat || 'json';
    const stream = typeof opts.stream === 'boolean' ? opts.stream : false;
    const primaryModel = opts.model || 'Whisper-Large-v3';

    async function postOnce(modelName) {
      const form = new FormData();
      form.append('file', audioBuffer, { filename: 'segment.wav' });
      form.append('model', modelName);
      form.append('response_format', responseFormat);
      form.append('stream', String(stream));
      if (language) form.append('language', language);

      const resp = await axios.post('https://api.sambanova.ai/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return resp && resp.data ? resp.data : null;
    }

    let data = null;
    try {
      data = await postOnce(primaryModel);
    } catch (err) {
      const status = err && err.response ? err.response.status : 0;
      const body = err && err.response ? err.response.data : null;
      if (status === 404 && body && /Model not found/i.test(String(body))) {
        const altModel = typeof primaryModel === 'string' ? primaryModel.toLowerCase() : primaryModel;
        console.warn('[SambaNova] Retrying with model:', altModel);
        data = await postOnce(altModel);
      } else {
        throw err;
      }
    }

    if (!data) return null;
    if (typeof data.text === 'string') return { text: data.text };
    if (data.results && Array.isArray(data.results)) {
      const first = data.results.find((r) => typeof r.text === 'string' && r.text.trim().length > 0);
      if (first) return { text: first.text };
    }
    return null;
  } catch (error) {
    const detail = error && error.response ? error.response.data : error && error.message ? error.message : String(error);
    console.error('SambaNova transcription error:', detail);
    return null;
  }
}

// Rewrite text using SambaNova chat completions API with customizable prompt.
// Returns rewritten text string or null. Optional AbortSignal supported.
async function rewriteTextSambaNova(text, prompt, apiKey, signal) {
  if (!apiKey) return null;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    console.warn('rewriteTextSambaNova called without a prompt');
    return null;
  }
  try {
    const url = 'https://api.sambanova.ai/v1/chat/completions';
    const body = {
      stream: false,
      model: 'Meta-Llama-3.3-70B-Instruct',
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${text}`,
        },
      ],
    };

    const resp = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
    console.error('SambaNova rewrite error:', detail);
    return null;
  }
}

module.exports = {
  transcribeAudioSambaNova,
  rewriteTextSambaNova,
};
