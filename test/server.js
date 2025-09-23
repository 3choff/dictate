/*
  Minimal local proxy server for the Mistral test page.
  - Serves test/ folder statically
  - Proxies POST /api/mistral/transcriptions to Mistral API, adding the API key server-side

  Usage:
    npm i express multer
    node test/server.js
    Open http://localhost:3000/test.html
*/

const path = require('path');
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer(); // memory storage
const PORT = process.env.PORT || 3000;

// Static serve the test directory
app.use(express.static(path.join(__dirname)));

// Proxy endpoint
app.post('/api/mistral/transcriptions', upload.single('file'), async (req, res) => {
  try {
    const apiKey = req.body.apiKey || process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing apiKey in form or MISTRAL_API_KEY env' });
    }

    const form = new FormData();

    if (req.file && req.file.buffer) {
      form.append('file', req.file.buffer, { filename: req.file.originalname || 'audio.wav' });
    }

    if (req.body.file_url) {
      form.append('file_url', req.body.file_url);
    }

    form.append('model', req.body.model || 'voxtral-mini-2507');
    if (req.body.language) form.append('language', req.body.language);

    const resp = await axios.post('https://api.mistral.ai/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': apiKey,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ error: err.message || String(err) });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Mistral test server listening on http://localhost:${PORT}`);
});
