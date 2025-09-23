/*
  Simple Mistral transcription tester.
  - Browser: exposes window.MistralTest.{transcribeFile, transcribeUrl}
  - Node: CLI usage with env MISTRAL_API_KEY and --file/--url args
*/

let fs, path, axios, NodeFormData;
if (typeof window === 'undefined') {
  fs = require('fs');
  path = require('path');
  axios = require('axios');
  NodeFormData = require('form-data');
} else {
  // Browser helpers using fetch
  async function transcribeFile(file, apiKey, { language, model = 'voxtral-mini-2507' } = {}) {
    if (!apiKey) throw new Error('Missing Mistral API key');
    const form = new FormData();
    form.append('file', file);
    form.append('model', model);
    if (language) form.append('language', language);
    const resp = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form,
    });
    const data = await resp.json();
    return { status: resp.status, data };
  }

  async function transcribeUrl(fileUrl, apiKey, { language, model = 'voxtral-mini-2507' } = {}) {
    if (!apiKey) throw new Error('Missing Mistral API key');
    const form = new FormData();
    form.append('file_url', fileUrl);
    form.append('model', model);
    if (language) form.append('language', language);
    const resp = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form,
    });
    const data = await resp.json();
    return { status: resp.status, data };
  }

  // Expose to window
  window.MistralTest = { transcribeFile, transcribeUrl };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) { args.file = argv[++i]; }
    else if (a === '--url' && argv[i + 1]) { args.url = argv[++i]; }
    else if (a === '--language' && argv[i + 1]) { args.language = argv[++i]; }
    else if (a === '--model' && argv[i + 1]) { args.model = argv[++i]; }
  }
  return args;
}

async function main() {
  const { file, url, language, model } = parseArgs(process.argv);
  const apiKey = process.env.MISTRAL_API_KEY || '';
  if (!apiKey) {
    console.error('Missing MISTRAL_API_KEY environment variable.');
    process.exit(1);
  }

  if (!file && !url) {
    console.error('Usage: node scripts/mistral_test.js --file <path> [--language en] [--model voxtral-mini-2507]');
    console.error('   or: node scripts/mistral_test.js --url <https://...> [--language en] [--model voxtral-mini-2507]');
    process.exit(1);
  }

  const FormDataCtor = (typeof window === 'undefined') ? NodeFormData : FormData;
  const form = new FormDataCtor();
  const chosenModel = model || 'voxtral-mini-2507';

  if (file) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      console.error('File not found:', abs);
      process.exit(1);
    }
    form.append('file', fs.createReadStream(abs));
  } else if (url) {
    form.append('file_url', url);
  }

  form.append('model', chosenModel);
  if (language) form.append('language', language);

  try {
    const resp = await axios.post('https://api.mistral.ai/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': apiKey,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('Status:', resp.status);
    console.log('Response JSON:', JSON.stringify(resp.data, null, 2));

    if (resp.data && typeof resp.data.text === 'string') {
      console.log('\nTranscribed text:\n', resp.data.text);
    }
  } catch (err) {
    if (err.response) {
      console.error('HTTP Error:', err.response.status);
      console.error('Response:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
    process.exit(2);
  }
}

if (typeof window === 'undefined') {
  main();
}
