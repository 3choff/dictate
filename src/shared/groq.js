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

module.exports = {
    transcribeAudio,
};
