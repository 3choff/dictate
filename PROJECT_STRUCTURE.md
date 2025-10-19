# Tauri Project Structure Guide

## Overview
This document explains the modular architecture of the Tauri implementation, designed to scale as features are added.

## Backend Structure (`src-tauri/src/`)

### 1. Commands Module (`commands/`)
Tauri command handlers organized by feature area.

**Current files:**
- `transcription.rs` - Batch transcription commands (Groq, Gemini, Mistral, SambaNova, Fireworks)
- `streaming.rs` - Streaming transcription commands (Deepgram, Cartesia) with WebSocket support
- `text_injection.rs` - Text insertion commands (clipboard and native typing)
- `text_rewrite.rs` - Grammar correction/text rewrite commands
- `settings.rs` - Settings management (load, save, window control)
- `vad.rs` - Voice Activity Detection commands (create, push, stop, destroy sessions)
- `mod.rs` - Module exports

**How to add a new command:**
```rust
// In commands/my_feature.rs
#[tauri::command]
pub async fn my_command(param: String) -> Result<String, String> {
    // Implementation
    Ok("result".to_string())
}

// In commands/mod.rs
pub mod my_feature;
pub use my_feature::*;

// In lib.rs
.invoke_handler(tauri::generate_handler![
    commands::my_feature::my_command,
])
```

### 2. Providers Module (`providers/`)
Transcription service implementations for all supported providers.

**Current files:**
- `groq.rs` - Groq Whisper-Large-v3-Turbo (batch)
- `deepgram.rs` - Deepgram Nova-3 (streaming WebSocket)
- `cartesia.rs` - Cartesia streaming with PCM pipeline (streaming WebSocket)
- `gemini.rs` - Google Gemini 2.5 Flash Lite (batch)
- `mistral.rs` - Mistral Voxtral (batch)
- `sambanova.rs` - SambaNova Whisper-Large-v3 (batch)
- `fireworks.rs` - Fireworks Whisper (batch)
- `mod.rs` - Module exports

**Architecture:**
- Batch providers: Accept audio bytes, return transcription string
- Streaming providers: Return channels for audio input and transcript output
- All use `reqwest` for HTTP/HTTPS or `tokio-tungstenite` for WebSocket

### 3. Services Module (`services/`)
Reusable business logic shared across commands.

**Current files:**
- `keyboard.rs` - Text injection via clipboard
- `keyboard_inject.rs` - Native keyboard injection using Windows API (via `enigo` crate)
- `windows_focus.rs` - Windows focus management (WS_EX_NOACTIVATE implementation)
- `mod.rs` - Module exports

**Purpose:**
- Keep commands thin (just parameter validation)
- Centralize system integration logic
- Provide consistent interface for text insertion
- Handle Windows-specific APIs

### 4. VAD Module (`vad/`)
Voice Activity Detection using Silero VAD model for intelligent speech segmentation.

**Current files:**
- `mod.rs` - Public interface with VoiceActivityDetector trait and VadFrame enum
- `silero.rs` - Silero VAD wrapper (30ms frames @ 16kHz)
- `smoothed.rs` - SmoothedVad wrapper with onset, hangover, and prefill buffering
- `session_manager.rs` - Thread-safe session manager with tokio async processing

**Architecture:**
- **Silero VAD**: ML-based speech detection (30ms frames, configurable threshold)
- **SmoothedVad**: Wraps Silero with onset detection (60ms), hangover (300ms), prefill (300ms)
- **VadSessionManager**: Manages concurrent sessions, emits speech segments via events
- **Non-blocking**: Uses tokio::spawn for async frame processing
- **Event-driven**: Emits "speech_segment_ready" events to frontend

**Key Features:**
- Runtime configurable silence threshold (default: 400ms)
- Max segment duration: 30 seconds
- Automatic silence trimming (only speech + buffers sent to API)
- Multi-session support for concurrent recordings
- Model path: `resources/models/silero_vad_v4.onnx`

**Benefits over RMS:**
- ML-based speech detection (ignores keyboard/mouse noise)
- No false positives from background sounds
- Mic-agnostic (works on all devices)
- Complete utterances preserved
- ~30% code reduction from old RMS approach

### 5. Voice Commands Module (`voice_commands.rs`)
Voice command processing system at root level.

**Features:**
- Regex-based command pattern matching
- 40+ command definitions (punctuation, keys, combinations)
- Command action types: KeyPress, KeyCombo, InsertText, DeleteLastWord, GrammarCorrect, PauseDictation
- Works with both streaming and batch providers
- Configurable via settings toggle

**Key structures:**
- `VoiceCommand` - Command definition with patterns and actions
- `CommandAction` - Enum of possible command actions
- `ProcessedTranscript` - Result after command processing
- `VoiceCommands` - Collection of all commands
- `process_voice_commands()` - Main processing function

## Frontend Structure (`ui/`)

### Provider Architecture (`main/providers/`)
Object-oriented provider system with inheritance and specialization.

**Base Classes:**
- `base-provider.js` - Abstract base class with common Tauri invoke logic
- `batch-provider.js` - Base for batch providers (Groq, Gemini, etc.) with VAD integration
- `streaming-provider.js` - Base for streaming providers (Deepgram, Cartesia)

**Batch Providers (extend BatchProvider):**
- `groq-provider.js` - Groq Whisper-Large-v3-Turbo
- `gemini-provider.js` - Google Gemini 2.5 Flash Lite  
- `mistral-provider.js` - Mistral Voxtral
- `sambanova-provider.js` - SambaNova Whisper-Large-v3
- `fireworks-provider.js` - Fireworks Whisper

**Streaming Providers (extend StreamingProvider):**
- `deepgram-provider.js` - Deepgram Nova-3 (WebSocket, PCM16)
- `cartesia-provider.js` - Cartesia (WebSocket, PCM16)

**Key Pattern:**
```javascript
// Batch providers only implement transcribeSegment()
export class GroqProvider extends BatchProvider {
    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {...});
    }
}

// Streaming providers implement start/stop/send
export class DeepgramProvider extends StreamingProvider {
    async start() { /* WebSocket setup */ }
    async sendAudio(data) { /* Send to backend */ }
    async stop() { /* Cleanup */ }
}
```

**Benefits:**
- DRY principle: VAD logic in BatchProvider only
- Easy to add new providers (just extend and implement one method)
- Type safety via class inheritance
- Consistent API across all providers

### Audio System (`main/audio/`)
Centralized audio capture and processing pipeline.

**Current files:**
- `audio-capture.js` - AudioContext manager, microphone access, PCM16 processing
- `audio-visualizer.js` - Real-time frequency visualization with perceptual weighting
- `audio-helpers.js` - DSP utilities (resampling, WAV encoding, RMS calculations)

**Architecture:**
```
Microphone → AudioContext → AudioWorkletProcessor
    ↓
    ├─→ Visualizer (FFT analysis)
    └─→ Provider callback (PCM16 @ 16kHz)
```

**Key Features:**
- Single AudioContext (no duplication)
- AudioWorkletProcessor for low-latency capture
- Automatic downsampling to 16kHz
- Perceptual weighting for speech visualization (85Hz-4kHz)
- 9-bar frequency display optimized for human speech

### Session Management (`main/session/`)
Recording session orchestration and state management.

**Current files:**
- `recording-session.js` - Session lifecycle, provider coordination, state machine

**Responsibilities:**
- Start/stop recording flows
- Provider initialization and cleanup
- Audio capture + visualizer coordination
- Error handling and recovery
- State transitions (idle → recording → processing)

##

### Window Folders (`main/`, `settings/`)
Each window has its own folder with complete isolation:

**main/** - Primary dictation window
- `index.html` - Window markup with mic button, sparkle, status
- `main.js` - Audio recording, transcription handling, UI state
- `styles.css` - Window styles with compact/expanded modes
- Audio assets: `beep.mp3`, `clack.mp3`

**settings/** - Settings configuration window
- `index.html` - Settings form with all provider options
- `settings.js` - Settings load/save logic
- `styles.css` - Settings window styling

**Benefits:**
- Clear separation of concerns
- Independent window development
- No naming conflicts
- Easy to maintain

### Assets (`assets/`)
Static resources used by the app:
- `icons/` - Application icons (ICO, PNG)
- `demo/` - Demo gif

## Architecture Patterns

### Batch Transcription Flow (with VAD)
1. User clicks mic → BatchProvider.start()
2. VAD session created in Rust (Silero model loaded)
3. AudioCaptureManager starts → PCM16 frames
4. Each frame sent to VAD via vad_push_frame (non-blocking)
5. Rust VAD analyzes speech, buffers detected speech
6. On silence (400ms) → Emit "speech_segment_ready" event
7. Frontend receives event → Convert PCM16 to WAV
8. Call transcribe_audio_segment with WAV bytes
9. Provider makes HTTP request to API
10. Voice commands processed (if enabled)
11. Text inserted via keyboard service
12. Repeat for next speech segment
13. Stop → Get final buffer → Destroy VAD session

### Streaming Transcription Flow (Deepgram/Cartesia)
1. User clicks mic → StreamingProvider.start()
2. Frontend calls start_streaming_transcription
3. Backend creates WebSocket connection to provider
4. Backend returns session ID
5. AudioCaptureManager starts → PCM16 frames
6. Each frame sent via send_streaming_audio
7. Backend forwards to WebSocket (no buffering)
8. Backend receives transcripts from WebSocket
9. Voice commands processed (if enabled)
10. Text inserted in real-time via keyboard service
11. Stop → Close WebSocket → Cleanup

### Settings Flow
1. Settings window calls `load_settings` on open
2. Backend reads JSON file from app data directory
3. User modifies settings in UI
4. Frontend calls `save_settings` command
5. Backend writes JSON file
6. Main window reads settings on launch

## Key Design Decisions

### 1. **Modular Frontend with ES6 Imports**
- ES6 modules for code organization
- Class-based provider system with inheritance
- Separate audio, session, and provider modules
- Clean separation: audio capture, VAD segmentation, transcription
- Minimal duplication via base classes

### 2. **VAD-Based Segmentation**
- Silero VAD (ML model) replaces RMS thresholds
- Smart silence detection (400ms configurable)
- Automatic audio trimming (no dead air sent to APIs)
- Prefill buffer (300ms) prevents word cutoffs
- Hangover (300ms) captures trailing sounds
- Non-blocking with tokio async

### 3. **Voice Commands at Root Level**
- `voice_commands.rs` is not in `services/` - it's a major feature
- Used by both `transcription.rs` and `streaming.rs`
- Single source of truth for all command definitions

### 4. **Separate Streaming Module**
- `streaming.rs` handles WebSocket lifecycle
- Different architecture from batch transcription
- Manages sessions with Arc<Mutex<HashMap>>
- Spawn async tasks for handling incoming transcripts

### 5. **Native Windows Integration**
- `enigo` crate for keyboard simulation
- `windows` crate for WS_EX_NOACTIVATE flag
- Direct Windows API when needed for reliability

### 6. **Settings Storage**
- JSON file in app data directory
- Simple flat structure (no nested objects)
- All settings loaded at startup
- Persisted immediately on change

## Best Practices

1. **Keep commands thin** - Validate parameters, delegate to services/providers
2. **One provider per file** - Self-contained with its own error handling
3. **Type safety** - Use Rust enums and structs, avoid stringly-typed data
4. **Async everywhere** - All commands are async, use tokio runtime
5. **Error propagation** - Use Result<T, String> for command returns
6. **Consistent naming** - Follow Rust conventions (snake_case for functions)
7. **Frontend simplicity** - Keep frontend logic minimal, business logic in Rust

## Development Tips

### Adding a New Batch Provider
1. **Backend**: Create `providers/new_provider.rs` with transcription function
2. **Backend**: Add to `providers/mod.rs` and `transcription.rs` match statement
3. **Frontend**: Create `ui/main/providers/new-provider.js`:
   ```javascript
   import { BatchProvider } from './batch-provider.js';
   export class NewProvider extends BatchProvider {
       getName() { return 'new_provider'; }
       async transcribeSegment(wavBytes) {
           await this.invoke('transcribe_audio_segment', {...});
       }
   }
   ```
4. **Frontend**: Register in provider factory
5. **Settings**: Add API key field to settings UI
6. **Test**: VAD segmentation works automatically!

### Adding a New Streaming Provider
1. **Backend**: Create streaming logic in `streaming.rs`
2. **Frontend**: Extend `StreamingProvider` class
3. **Frontend**: Implement start(), sendAudio(), stop()
4. **Test**: Real-time transcription flow

### Debugging
- **Frontend**: `console.log()` visible in DevTools (Ctrl+Shift+L)
- **Backend**: Error logs only (success logs removed for production)
- **Terminal**: Check `cargo tauri dev` output for Rust errors
- **VAD**: Error logs kept for push_frame failures
- **Verbose**: Enable with `RUST_LOG=debug cargo tauri dev`

### Testing
- Manual testing with each provider
- Test voice commands with different phrases
- Test both compact and expanded modes
- Test settings persistence (close/reopen)
- Test keyboard injection in different apps
