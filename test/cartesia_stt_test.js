/*
 * Cartesia STT WebSocket test harness
 * -----------------------------------
 * This standalone script connects to Cartesia's streaming speech-to-text endpoint.
 * It intentionally lives under `test/` so it does not impact the production build.
 *
 * Usage:
 *   1. Install dependencies (ws, wav, mic) if you haven't already: `npm install ws wav mic`.
 *   2. Set the CARTESIA_API_KEY environment variable with your Cartesia key.
 *   3. Run: `node test/cartesia_stt_test.js`
 *
 * The script captures microphone audio (16 kHz PCM) and streams it to Cartesia.
 * Incremental transcripts are logged to the console. Say "stop test" or press Ctrl+C to exit.
 */

const WebSocket = require('ws');
const mic = require('mic');

const CARTESIA_ENDPOINT = 'wss://api.cartesia.ai/stt/websocket';
const CARTESIA_VERSION = '2025-04-16';
const CARTESIA_MODEL = 'ink-whisper';
const SAMPLE_RATE = 16000;
const ENCODING = 'pcm_s16le';

const apiKey = process.env.CARTESIA_API_KEY;
if (!apiKey) {
  console.error('CARTESIA_API_KEY environment variable not set.');
  process.exit(1);
}

const queryParams = new URLSearchParams({
  model: CARTESIA_MODEL,
  encoding: ENCODING,
  sample_rate: SAMPLE_RATE.toString(),
});

const ws = new WebSocket(`${CARTESIA_ENDPOINT}?${queryParams.toString()}`, {
  headers: {
    'Cartesia-Version': CARTESIA_VERSION,
    'X-API-Key': apiKey,
  },
});

ws.on('open', () => {
  console.log('Connected to Cartesia STT WebSocket. Streaming microphone audio...');
  startStreaming();
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.type === 'transcript') {
      const prefix = message.is_final ? '[FINAL ]' : '[PARTIAL]';
      console.log(`${prefix} ${message.text}`);
    } else if (message.type === 'flush_done') {
      console.log('[Cartesia] Flush complete.');
    } else if (message.type === 'done') {
      console.log('[Cartesia] Session done.');
      process.exit(0);
    } else if (message.type === 'error') {
      console.error('[Cartesia] Error:', message.message || 'Unknown error');
    }
  } catch (err) {
    console.error('Failed to parse message:', err);
  }
});

ws.on('close', (code, reason) => {
  console.log(`WebSocket closed: code=${code}, reason=${reason}`);
  stopMic();
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  stopMic();
});

let micInstance;
let micInputStream;

function startStreaming() {
  micInstance = mic({
    rate: SAMPLE_RATE.toString(),
    channels: '1',
    debug: false,
    encoding: 'signed-integer',
    endian: 'little',
    bitwidth: '16',
  });

  micInputStream = micInstance.getAudioStream();
  micInputStream.on('data', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  micInputStream.on('error', (err) => {
    console.error('Mic input error:', err);
  });

  micInstance.start();

  console.log('Microphone capture started. Say "stop test" or press Ctrl+C to finish.');
}

function stopMic() {
  if (micInstance) {
    micInstance.stop();
    micInstance = null;
  }
}

function finalizeSession() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send('finalize');
    ws.send('done');
  }
}

process.on('SIGINT', () => {
  console.log('\nCaught SIGINT, closing session...');
  finalizeSession();
  setTimeout(() => process.exit(0), 500);
});
