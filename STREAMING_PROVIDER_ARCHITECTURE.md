# Streaming Provider Architecture for Tauri

## Overview

This document defines a standardized architecture for streaming transcription providers (Deepgram, Cartesia) that use WebSocket connections instead of batch audio uploads.

## Key Differences: Batch vs Streaming

### Batch Providers (Groq, SambaNova, Fireworks, Gemini, Mistral)
- Send complete audio file after recording stops
- Backend processes entire audio at once
- Single HTTP request/response
- Higher latency (wait for full recording)
- Simpler implementation

### Streaming Providers (Deepgram, Cartesia)
- Send audio chunks in real-time during recording
- Backend streams audio over WebSocket
- Continuous bidirectional communication
- Lower latency (instant transcription)
- More complex implementation

## Electron App Analysis

### Deepgram Implementation (`deepgram.js`)

**Key Features:**
1. WebSocket URL: `wss://api.deepgram.com/v1/listen`
2. Auth: API key in WebSocket subprotocol: `['token', apiKey]`
3. Encoding: Prefers `audio/webm;codecs=opus` (falls back to browser default)
4. Query Parameters:
   - `model`: 'nova-3' (default)
   - `language`: 'multi' or specific ('en', 'it', etc.)
   - `punctuate`: false (default)
   - `smart_format`: false (default, or based on user setting)
   - `interim_results`: false (default)
   - `encoding`: 'opus' (if supported)
   - `endpointing`: 100 (ms of silence before finalizing)

**Message Flow:**
```
Client → Deepgram: Audio chunks (binary Blob data)
Deepgram → Client: JSON messages
  {
    "type": "Results",
    "is_final": true,
    "speech_final": true,
    "channel": {
      "alternatives": [
        { "transcript": "hello world" }
      ]
    }
  }
```

**Electron Implementation:**
```javascript
// 1. Create WebSocket
dgSocket = new WebSocket(wsUrl, ['token', dgKey]);

// 2. On open, start MediaRecorder
dgSocket.onopen = () => {
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0 && dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(event.data);  // Send binary audio chunks
    }
  };
  mediaRecorder.start(250);  // Send chunk every 250ms
};

// 3. On message, extract transcript
dgSocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'Results' && (msg.is_final || msg.speech_final)) {
    const transcript = msg.channel.alternatives[0].transcript.trim();
    processTranscript(transcript);  // Insert text
  }
};
```

### Cartesia Implementation (`cartesia.js`)

**Key Features:**
1. WebSocket URL: `wss://api.cartesia.ai/stt/websocket`
2. Auth: API key in URL query param: `?api_key=...`
3. Encoding: Requires PCM 16-bit LE (`pcm_s16le`)
4. Sample Rate: 16000 Hz (required)
5. Query Parameters:
   - `model`: 'ink-whisper' (default)
   - `encoding`: 'pcm_s16le' (required)
   - `sample_rate`: 16000 (required)
   - `api_key`: API key (required in browser)
   - `cartesia_version`: '2025-04-16'
   - `language`: optional (omit for multilingual)

**Message Flow:**
```
Client → Cartesia: PCM audio chunks (binary ArrayBuffer)
Cartesia → Client: JSON messages
  {
    "type": "transcript",
    "is_final": true,
    "text": "hello world"
  }
```

**Electron Implementation:**
```javascript
// 1. Create AudioContext for PCM conversion
ctAudioCtx = new AudioContext();
ctSource = ctAudioCtx.createMediaStreamSource(stream);
ctProcessor = ctAudioCtx.createScriptProcessor(4096, 1, 1);

// 2. Convert to PCM and send
ctProcessor.onaudioprocess = (ev) => {
  const inBuf = ev.inputBuffer;
  const channelData = inBuf.getChannelData(0);  // Float32Array [-1, 1]
  
  // Resample to 16kHz if needed
  const resampled = resample(channelData, ctAudioCtx.sampleRate, 16000);
  
  // Convert Float32 to Int16 PCM
  const pcm = new Int16Array(resampled.length);
  for (let i = 0; i < resampled.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.floor(resampled[i] * 32768)));
  }
  
  // Send to Cartesia
  if (ctSocket.readyState === WebSocket.OPEN) {
    ctSocket.send(pcm.buffer);
  }
};

// 3. On message, extract transcript
ctSocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'transcript' && msg.is_final) {
    processTranscript(msg.text.trim());
  }
};
```

## Tauri Architecture Design

### Challenge: Frontend vs Backend WebSocket

**Electron Approach:**
- Frontend (renderer) creates WebSocket directly
- MediaRecorder runs in browser context
- Simple: all audio handling in JavaScript

**Tauri Constraints:**
- Cannot create WebSocket from Tauri commands (async runtime issues)
- Cannot easily stream audio from frontend to backend over IPC
- Need frontend WebSocket OR new architecture

### Proposed Solution: Frontend WebSocket (Hybrid Approach)

**Architecture:**
```
Frontend (Browser)
  ├─ MediaRecorder → Audio Chunks
  ├─ WebSocket → Deepgram/Cartesia
  └─ On Transcript → invoke('insert_streaming_text')
  
Backend (Rust)
  └─ insert_streaming_text() → Types text or uses clipboard
```

**Why This Approach:**
1. **Simplicity**: Reuses Electron's proven WebSocket logic
2. **Browser APIs**: MediaRecorder already in frontend
3. **No IPC Bottleneck**: Audio streams directly to provider
4. **Clean Separation**: Frontend handles streaming, backend handles insertion
5. **Future-Proof**: Easy to add more streaming providers

### Alternative (Not Recommended): Backend WebSocket

**Would require:**
1. Frontend captures audio → encodes → sends to backend via IPC
2. Backend creates WebSocket → streams audio
3. Backend receives transcript → sends to frontend via events
4. Frontend inserts text

**Problems:**
- IPC overhead for continuous audio streaming
- Complex audio encoding in frontend (WAV/PCM)
- Tauri async runtime issues with WebSocket
- More code, more complexity

## Implementation Plan

### Phase 1: Deepgram Provider (Frontend)

**Files to Create:**
- `ui/providers/deepgram.js` - WebSocket logic (adapted from Electron)
- `ui/providers/streaming.js` - Shared streaming utilities

**Files to Modify:**
- `ui/main/main.js` - Add Deepgram streaming mode
- `ui/main/index.html` - Load provider scripts
- `ui/settings/index.html` - Add Deepgram option
- `ui/settings/settings.js` - Load/save Deepgram key

**Backend Changes:**
- `src/commands/settings.rs` - Add `deepgram_api_key` field
- `src/commands/text_insertion.rs` - Expose `insert_streaming_text()` command

**Deepgram Command:**
```rust
#[tauri::command]
pub async fn insert_streaming_text(
    text: String,
    insertion_mode: String,
) -> Result<(), String> {
    // Same logic as insert_text but without audio data
    if insertion_mode == "typing" {
        services::typing::type_text(&text).await?;
    } else {
        services::clipboard::insert_via_clipboard(&text)?;
    }
    Ok(())
}
```

### Phase 2: Cartesia Provider (Frontend)

**Files to Create:**
- `ui/providers/cartesia.js` - WebSocket + PCM conversion logic

**Files to Modify:**
- `ui/main/main.js` - Add Cartesia streaming mode
- `ui/settings/index.html` - Add Cartesia option
- `ui/settings/settings.js` - Load/save Cartesia key

**Backend Changes:**
- `src/commands/settings.rs` - Add `cartesia_api_key` field

**Reuse:** Same `insert_streaming_text()` command

### Phase 3: Audio Utilities (Frontend)

**Create `ui/providers/audio-utils.js`:**
```javascript
// Resampling for Cartesia (48kHz → 16kHz)
function resample(audioData, fromRate, toRate) {
  const ratio = toRate / fromRate;
  const newLength = Math.round(audioData.length * ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i / ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    
    if (idx + 1 < audioData.length) {
      result[i] = audioData[idx] * (1 - frac) + audioData[idx + 1] * frac;
    } else {
      result[i] = audioData[idx];
    }
  }
  
  return result;
}

// Convert Float32 to Int16 PCM
function float32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const val = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = val < 0 ? val * 32768 : val * 32767;
  }
  return int16Array;
}
```

## Standardized Provider Interface

### Frontend Provider Module Structure

```javascript
// ui/providers/deepgram.js or cartesia.js
const Provider = {
  // Build WebSocket URL with query params
  buildUrl(options) {
    // options: { apiKey, model, language, encoding, ... }
    return 'wss://...';
  },
  
  // Create WebSocket connection
  createSocket(apiKey, url) {
    // Deepgram: new WebSocket(url, ['token', apiKey])
    // Cartesia: new WebSocket(url) // key in URL
  },
  
  // Check if message contains final transcript
  isFinalMessage(msg) {
    // Deepgram: msg.is_final || msg.speech_final
    // Cartesia: msg.is_final
  },
  
  // Extract transcript text from message
  extractTranscript(msg) {
    // Deepgram: msg.channel.alternatives[0].transcript
    // Cartesia: msg.text
  },
  
  // Optional: Get preferred audio format
  getAudioConfig() {
    // Deepgram: { mimeType: 'audio/webm;codecs=opus', encoding: 'opus' }
    // Cartesia: { requiresPCM: true, sampleRate: 16000 }
  }
};
```

### Main Recording Logic (Unified)

```javascript
async function startStreamingRecording(provider, apiKey, options) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  // Build URL
  const wsUrl = provider.buildUrl({ apiKey, ...options });
  
  // Create socket
  const socket = provider.createSocket(apiKey, wsUrl);
  
  // Setup MediaRecorder or AudioContext based on provider
  const config = provider.getAudioConfig?.() || {};
  
  if (config.requiresPCM) {
    // Cartesia path: AudioContext + ScriptProcessor
    setupPCMStreaming(stream, socket, config);
  } else {
    // Deepgram path: MediaRecorder
    setupMediaRecorderStreaming(stream, socket, config);
  }
  
  // Handle messages
  socket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (provider.isFinalMessage(msg)) {
      const transcript = provider.extractTranscript(msg);
      if (transcript) {
        await invoke('insert_streaming_text', {
          text: transcript,
          insertionMode: INSERTION_MODE
        });
      }
    }
  };
}
```

## Settings Structure

```rust
#[derive(Serialize, Deserialize)]
pub struct Settings {
    // Batch providers
    pub groq_api_key: String,
    pub sambanova_api_key: String,
    pub fireworks_api_key: String,
    pub gemini_api_key: String,
    pub mistral_api_key: String,
    
    // Streaming providers
    pub deepgram_api_key: String,
    pub cartesia_api_key: String,
    
    // Provider selection
    pub api_service: String,  // "groq" | "deepgram" | "cartesia" | ...
    
    // Other settings...
}
```

## UI Changes

### Settings Dropdown

```html
<select id="api-service">
  <!-- Batch providers -->
  <optgroup label="Batch Processing">
    <option value="groq">Groq Whisper</option>
    <option value="sambanova">SambaNova Whisper</option>
    <option value="fireworks">Fireworks Whisper</option>
    <option value="gemini">Gemini Flash Lite</option>
    <option value="mistral">Mistral Voxtral</option>
  </optgroup>
  
  <!-- Streaming providers -->
  <optgroup label="Real-Time Streaming">
    <option value="deepgram">Deepgram Nova 3</option>
    <option value="cartesia">Cartesia Whisper</option>
  </optgroup>
</select>
```

### Provider Detection

```javascript
const STREAMING_PROVIDERS = ['deepgram', 'cartesia'];
const isStreaming = STREAMING_PROVIDERS.includes(API_SERVICE);

if (isStreaming) {
  startStreamingRecording();
} else {
  startBatchRecording();
}
```

## Testing Plan

### Deepgram Test
1. Get API key from https://console.deepgram.com/
2. Select "Deepgram Nova 3" in settings
3. Enter API key
4. Press Ctrl+Shift+D
5. Speak continuously
6. Observe real-time transcription appearing
7. Release to stop

### Cartesia Test
1. Get API key from https://www.cartesia.ai/
2. Select "Cartesia Whisper" in settings
3. Enter API key
4. Press Ctrl+Shift+D
5. Speak continuously
6. Observe real-time transcription appearing
7. Release to stop

## Performance Considerations

### Deepgram
- **Latency**: ~100-300ms (very fast)
- **Chunk Size**: 250ms recommended
- **Bandwidth**: ~20 KB/s (opus compression)
- **Best For**: Real-time dictation, live captions

### Cartesia
- **Latency**: ~200-400ms (fast)
- **Chunk Size**: 4096 samples @ 16kHz = ~256ms
- **Bandwidth**: ~32 KB/s (PCM uncompressed)
- **Best For**: High accuracy, multilingual

### Batch Providers (Reference)
- **Latency**: 1-5 seconds (after recording completes)
- **Best For**: Long recordings, offline processing

## Error Handling

```javascript
socket.onerror = (error) => {
  console.error(`${providerName} WebSocket error:`, error);
  status.textContent = `Connection error - check API key`;
};

socket.onclose = (event) => {
  console.log(`${providerName} WebSocket closed:`, event.code, event.reason);
  if (event.code === 1008) {
    status.textContent = 'Invalid API key';
  } else if (event.code === 1006) {
    status.textContent = 'Connection lost';
  }
  stopRecording();
};
```

## Summary

### Advantages of Frontend WebSocket Approach
✅ **Simple**: Reuses proven Electron architecture
✅ **Efficient**: No IPC bottleneck for audio streaming
✅ **Browser-Native**: Leverages MediaRecorder, WebSocket, AudioContext
✅ **Maintainable**: Clear separation of concerns
✅ **Extensible**: Easy to add more streaming providers

### Implementation Checklist
- [ ] Create `ui/providers/deepgram.js`
- [ ] Create `ui/providers/cartesia.js`
- [ ] Create `ui/providers/audio-utils.js`
- [ ] Add `insert_streaming_text` command
- [ ] Update settings structure
- [ ] Update UI for provider selection
- [ ] Add streaming detection logic
- [ ] Test with both providers
- [ ] Update documentation

**Next Step**: Implement Deepgram provider following this architecture.
