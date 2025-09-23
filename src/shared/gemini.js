const axios = require('axios');

// Transcribe audio using Google Gemini Generative Language API (v1beta)
// Sends inline base64 WAV data and extracts the first text candidate.
async function transcribeAudioGemini(audioBuffer, apiKey) {
  if (!apiKey) {
    console.error('Gemini API key is not configured.');
    return null;
  }
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
    const base64 = Buffer.from(audioBuffer).toString('base64');
    const body = {
      contents: [
        {
          parts: [
            { text: 'Generate a transcript of the speech.' },
            {
              inline_data: {
                mime_type: 'audio/wav',
                data: base64,
              },
            },
          ],
        },
      ],
    };
    const resp = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    const candidates = (resp && resp.data && resp.data.candidates) || [];
    for (const c of candidates) {
      const parts = c && c.content && c.content.parts;
      if (Array.isArray(parts)) {
        const textPart = parts.find((p) => typeof p.text === 'string' && p.text.trim().length > 0);
        if (textPart) return { text: textPart.text };
      }
    }
    return null;
  } catch (error) {
    console.error('Gemini transcription error:', error.response ? error.response.data : error.message);
    return null;
  }
}

module.exports = {
  transcribeAudioGemini,
};
