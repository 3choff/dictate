const axios = require('axios');
const FormData = require('form-data');

async function transcribeAudio(audioBuffer, apiKey) {
    if (!apiKey) {
        console.error('API key is not configured.');
        return null;
    }

    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'output.wav' });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error transcribing audio:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Rewrite text using Groq chat completions API with customizable prompt
// Returns rewritten text string or null. Optional AbortSignal supported.
async function rewriteTextGroq(text, prompt, apiKey, signal) {
    if (!apiKey) return null;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        console.warn('rewriteTextGroq called without a prompt');
        return null;
    }
    try {
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const body = {
            model: 'openai/gpt-oss-120b',
            messages: [
                {
                    role: 'user',
                    content: prompt + '\n\n' + text,
                },
            ],
            temperature: 0.2,
            top_p: 1,
            stream: false,
            max_completion_tokens: 1024,
        };
        const resp = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            signal,
        });
        const choice = resp?.data?.choices?.[0];
        const content = choice?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) return content;
        return null;
    } catch (_) {
        return null;
    }
}

module.exports = {
    transcribeAudio,
    rewriteTextGroq,
};
