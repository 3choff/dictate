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
- `text_rewrite.rs` - Text rewrite commands (grammar correction, tone adjustment, structured reformulation)
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
Service implementations for transcription and text rewriting.

**Current files:**
- `groq.rs` - Groq Whisper-Large-v3-Turbo (batch transcription) + GPT-OSS-120B (text rewrite)
- `deepgram.rs` - Deepgram Nova-3 (streaming WebSocket transcription)
- `cartesia.rs` - Cartesia streaming with PCM pipeline (streaming WebSocket transcription)
- `gemini.rs` - Google Gemini 2.5 Flash Lite (batch transcription + text rewrite)
- `mistral.rs` - Mistral Voxtral (batch transcription) + Mistral Small (text rewrite)
- `sambanova.rs` - SambaNova Whisper-Large-v3 (batch transcription) + Llama-3.3-70B (text rewrite)
- `fireworks.rs` - Fireworks Whisper (batch transcription) + GPT-OSS-20B (text rewrite)
- `mod.rs` - Module exports

**Architecture:**
- Batch transcription: Accept audio bytes, return transcription string
- Streaming transcription: Return channels for audio input and transcript output
- Text rewriting: Accept text + prompt, return rewritten text via chat completions API
- All use `reqwest` for HTTP/HTTPS or `tokio-tungstenite` for WebSocket

### 3. Services Module (`services/`)
Reusable business logic shared across commands.

**Current files:**
- `clipboard_paste.rs` - Text injection via clipboard
- `direct_typing.rs` - Native keyboard injection using Windows API (via `enigo` crate)
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

### 5. Voice Commands Module (`voice_commands/`)
Voice command processing system organized by language.

**Structure:**
- `mod.rs` - Main module with `VoiceCommands` struct and `new_with_language()` factory
- `en.rs` - English command definitions
- `it.rs`, `es.rs`, `fr.rs`, `de.rs`, `nl.rs`, `pt.rs`, `zh.rs`, `ja.rs`, `ru.rs` - Language-specific modules

**Features:**
- **Multi-language support**: 10 languages (English, Italian, Spanish, French, German, Dutch, Portuguese, Chinese, Japanese, Russian)
- **Factory pattern**: `new_with_language(lang)` loads correct command set
- **Regex-based matching**: Flexible pattern recognition for each language
- **Unified Action System**: Same `CommandAction` types for all languages
- **Consistent API**: Works with both streaming and batch providers

**Key structures:**
- `VoiceCommands` - Struct containing language-specific command HashMap
- `CommandAction` - Enum of actions (KeyPress, KeyCombo, InsertText, DeleteLastWord, Rewrite, PauseDictation)
- `process_voice_commands()` - Main processing function using regex

**Notable commands (English examples):**
- "press rewrite" - Triggers text rewrite
- "delete that" - Deletes last word
- "pause voice typing" - Pauses recording

## Frontend Structure (`ui/`)

**Note:** The frontend uses direct Tauri API access (`window.__TAURI__`) without wrapper utilities. All shared constants and utilities have been removed in favor of direct implementation.

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

### Window Folders (`main/`, `settings/`, `tray-menu/`)
Each window has its own folder with complete isolation:

**main/** - Primary dictation window
- `index.html` - Window markup with mic button, rewrite button (sparkle icon), close buttons
- `main.js` - Audio recording, transcription handling, text rewrite functionality, UI state
- `styles.css` - Window styles with compact/expanded modes
- Audio assets: `beep.mp3`, `clack.mp3`

**settings/** - Settings configuration window
- `index.html` - Settings form with tabbed interface
- `settings.js` - Settings logic and section management
- `styles.css` - Settings styling
- `sections/` - Modular section components
- `components/` - Reusable UI components
- `locales/` - (in `ui/shared/locales/`) JSON translation files (en.json, it.json, etc.)

**tray-menu/** - Custom system tray menu window
- `index.html` - Menu list UI
- `styles.css` - Native-like menu styling (clamped to screen, hover effects)
- (Logic handled via inline script or simple JS)

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

### Text Rewrite Flow (Ctrl+Shift+R)
1. User selects text and presses Ctrl+Shift+R (or clicks sparkle button)
2. Voice command "press rewrite" also triggers this flow
3. Frontend calls `copy_selected_text` (simulates Ctrl+C)
4. Frontend calls `rewrite_text` with selected text
5. Backend reads settings to get rewrite provider and mode
6. Backend selects prompt based on mode:
   - `grammar_correction` - Fix spelling and grammar
   - `professional` - Formal business tone
   - `polite` - Courteous and respectful
   - `casual` - Conversational and relaxed
   - `structured` - Well-organized with clear flow
7. Backend calls provider API (Groq/Gemini/Mistral/SambaNova/Fireworks)
8. Provider returns rewritten text
9. Frontend calls `insert_text` with clipboard mode
10. Rewritten text replaces selected text

### Settings Flow
1. Settings window calls `load_settings` on open
2. Backend reads JSON file from app data directory
3. User modifies settings in UI (with auto-save after 500ms)
4. Frontend calls `save_settings` command
5. Backend writes JSON file with explicit disk sync
6. Settings changes emit event to main window
7. Keyboard shortcuts re-registered via `reregister_shortcuts`
8. Main window reloads settings dynamically

### Keyboard Shortcuts System
**Current shortcuts (all customizable):**
- `Ctrl+Shift+D` - Toggle recording
- `Ctrl+Shift+R` - Text rewrite
- `Ctrl+Shift+V` - Toggle compact mode
- `Ctrl+Shift+S` - Toggle settings window
- `Ctrl+Shift+L` - Toggle DevTools (debug)
- `Ctrl+Shift+X` - Exit application

**Architecture:**
- Backend: `tauri-plugin-global-shortcut` for system-wide hotkeys
- Settings: Stored in `keyboard_shortcuts` object in settings.json
- Registration: Dynamic via `register_shortcuts()` in lib.rs at startup
- Re-registration: `reregister_shortcuts()` command applies changes without restart
- UI: Custom `ShortcutInput` component captures key combinations
- Persistence: Auto-saved with 500ms debounce

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
