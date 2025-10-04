# Dictate - Tauri Migration (Proof of Concept)

This branch contains a minimal Tauri implementation to test performance and bundle size compared to the Electron version.

## Project Structure

```
tauri-src/
├── src/
│   ├── commands/           # Tauri command handlers
│   │   ├── transcription.rs
│   │   ├── text_injection.rs
│   │   └── window.rs
│   ├── providers/          # Transcription providers
│   │   └── groq.rs
│   ├── services/           # Business logic
│   │   └── keyboard.rs
│   ├── lib.rs             # App setup
│   └── main.rs
├── capabilities/           # Permission definitions
└── tauri.conf.json

ui/
├── main/                   # Main window
│   ├── index.html
│   ├── main.js
│   └── styles.css
└── shared/                 # Shared utilities
    ├── api.js
    └── constants.js
```

## Current Status

**Implemented:**
- ✅ Basic recording UI
- ✅ Groq Whisper transcription
- ✅ Clipboard-based text insertion
- ✅ Global shortcut (Ctrl+Shift+D)
- ✅ Always-on-top frameless window

**Not Yet Implemented:**
- ❌ Multiple providers (Deepgram, Cartesia, Gemini, etc.)
- ❌ Settings window
- ❌ Voice commands
- ❌ Grammar correction
- ❌ Compact mode
- ❌ Native keyboard injection

## Prerequisites

- Rust 1.70+ (installed ✓)
- Node.js (for development)
- WebView2 (usually pre-installed on Windows 10/11)

## Setup

1. **Configure API Key**  
   Edit `ui/main.js` and replace `YOUR_GROQ_API_KEY_HERE` with your actual Groq API key.

2. **Install Tauri CLI**  
   ```bash
   cargo install tauri-cli --version "^2.0.0"
   ```

3. **Build and Run**  
   ```bash
   cargo tauri dev
   ```

## Building for Production

```bash
cargo tauri build
```

The executable will be in `tauri-src/target/release/`.

## Size Comparison

| Version | Bundle Size | Startup Time |
|---------|-------------|--------------|
| Electron (current) | ~180-200MB | 2-4s |
| Tauri (this POC) | TBD | TBD |

## Next Steps

1. Test basic dictation workflow
2. Measure bundle size and startup time
3. Decide whether to continue full migration
4. If proceeding, implement remaining features incrementally
