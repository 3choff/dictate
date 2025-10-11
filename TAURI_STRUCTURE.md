# Tauri Project Structure Guide

## Overview
This document explains the modular architecture of the Tauri implementation, designed to scale as features are added.

## Backend Structure (`tauri-src/src/`)

### 1. Commands Module (`commands/`)
Tauri command handlers organized by feature area.

**Current files:**
- `transcription.rs` - Batch transcription commands (Groq, Gemini, Mistral, SambaNova, Fireworks)
- `streaming.rs` - Streaming transcription commands (Deepgram, Cartesia) with WebSocket support
- `text_injection.rs` - Text insertion commands (clipboard and native typing)
- `text_rewrite.rs` - Grammar correction/text rewrite commands
- `settings.rs` - Settings management (load, save, window control)
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

### 4. Voice Commands Module (`voice_commands.rs`)
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

### 1. Window Folders (`main/`, `settings/`)
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

### 2. Assets (`assets/`)
Static resources used by the app:
- `icons/` - Application icons (ICO, PNG)
- `demo/` - Demo gif

## Architecture Patterns

### Batch Transcription Flow
1. Frontend captures audio → WAV blob
2. Frontend calls `transcribe_audio` command with provider name
3. Backend routes to appropriate provider (match statement)
4. Provider makes HTTP request to API
5. Provider returns transcription string
6. Voice commands processed (if enabled)
7. Text inserted via keyboard service

### Streaming Transcription Flow
1. Frontend starts streaming session via `start_streaming_transcription`
2. Backend creates WebSocket connection to provider
3. Backend returns session ID and channels
4. Frontend sends audio chunks via `send_audio_chunk`
5. Backend receives transcripts from WebSocket
6. Voice commands processed (if enabled)
7. Text inserted in real-time via keyboard service

### Settings Flow
1. Settings window calls `load_settings` on open
2. Backend reads JSON file from app data directory
3. User modifies settings in UI
4. Frontend calls `save_settings` command
5. Backend writes JSON file
6. Main window reads settings on launch

## Key Design Decisions

### 1. **No Shared Frontend Module**
- Each window is self-contained
- Avoids module loading complexity
- Tauri IPC is the communication layer
- Duplicates minimal (each window has simple invoke calls)

### 2. **Voice Commands at Root Level**
- `voice_commands.rs` is not in `services/` - it's a major feature
- Used by both `transcription.rs` and `streaming.rs`
- Single source of truth for all command definitions

### 3. **Separate Streaming Module**
- `streaming.rs` handles WebSocket lifecycle
- Different architecture from batch transcription
- Manages sessions with Arc<Mutex<HashMap>>
- Spawn async tasks for handling incoming transcripts

### 4. **Native Windows Integration**
- `enigo` crate for keyboard simulation
- `windows` crate for WS_EX_NOACTIVATE flag
- Direct Windows API when needed for reliability

### 5. **Settings Storage**
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

### Adding a New Provider
1. Create `providers/new_provider.rs`
2. Implement transcription function matching existing patterns
3. Add to `providers/mod.rs`: `pub mod new_provider;`
4. Update `transcription.rs` match statement to route to new provider
5. Add API key field to settings UI
6. Test with real API key

### Debugging
- Use `console.log()` in frontend (visible in DevTools)
- Use `println!()` or `eprintln!()` in Rust (visible in terminal)
- Check terminal output when running `cargo tauri dev`
- Enable verbose logs with `RUST_LOG=debug`

### Testing
- Manual testing with each provider
- Test voice commands with different phrases
- Test both compact and expanded modes
- Test settings persistence (close/reopen)
- Test keyboard injection in different apps

## Implementation Status

**Completed (v1.0.0):**
- ✅ All 7 transcription providers (Groq, Deepgram, Cartesia, Gemini, Mistral, SambaNova, Fireworks)
- ✅ Streaming support (Deepgram, Cartesia)
- ✅ Batch transcription (Groq, Gemini, Mistral, SambaNova, Fireworks)
- ✅ Voice commands (40+ commands)
- ✅ Native keyboard injection
- ✅ Clipboard injection
- ✅ Settings window with all options
- ✅ Grammar correction (5 providers)
- ✅ Global shortcuts (Ctrl+Shift+D, Ctrl+Shift+G)
- ✅ Compact mode with persistence
- ✅ Audio cues (beep/clack)
- ✅ Window focus management

**Future Enhancements:**
- Window position persistence
- System tray icon
- Auto-updater
- Custom keyboard shortcuts
- Unit tests
- Integration tests
