## [1.3.0] - 2025-10-16

### Added
- **Audio Visualizer**: Complete implementation with real-time animated bars that respond to microphone input across all transcription providers (Deepgram, Cartesia, Groq, OpenAI, etc.)
- **Unified Audio Architecture**: Centralized audio capture and visualization pipeline that eliminates stream contention and improves performance
- **Visual Bar Amplification**: Enhanced responsiveness with taller bars and better visual feedback for lower audio levels

### Improved
- **Stream Contention Fix**: Eliminated dual audio processing issues for Deepgram provider by cloning streams appropriately
- **Bar Reset Functionality**: Visualizer bars now properly reset to gray/4px state when recording stops
- **Compact View UI**: Enhanced compact mode visual appearance and transitions
- **Cross-Provider Visualizer**: Extended visualizer support to all batch providers (Groq, OpenAI, Sambanova, etc.) in addition to streaming providers

### Technical
- **Audio Processing Pipeline**: Restructured audio capture flow for better resource management and visualization accuracy
- **Error Handling**: Improved visualizer error handling and cleanup procedures
- **Performance**: Optimized audio processing to reduce latency and improve responsiveness

## [1.2.2] - 2025-10-14

### Improved
- **Cross-platform clipboard typing:** Replaced Windows-specific `clipboard-win` with `tauri_plugin_clipboard_manager` for better macOS/Linux compatibility
- **Virtual key code paste:** Updated paste commands to use platform-specific virtual key codes (VK_V on Windows, Key::Other(9) on macOS) for better keyboard layout compatibility
- **Direct typing improvements:** Enhanced direct typing method to use single-call text injection instead of per-character loops, improving speed and reliability
- **Better error handling:** Improved error messages throughout keyboard injection functions for easier debugging

## [1.2.0] - 2025-10-12

### Changed
- Modified settings window to remove shadow (`src-tauri/src/commands/settings.rs`).
- Updated SVG for settings button in `ui/main/index.html`.
- Updated SVG for help button in `ui/settings/index.html`.
- Added `overflow: hidden;` to `html, body` in `ui/main/styles.css` and `ui/settings/styles.css`.
- General settings UI and logic improvements (`ui/settings/settings.js`).

---

## [1.1.0] - 2025-10-12

### Added
- **Version in settings footer:** The app version is now displayed in the settings window (`ui/settings/index.html` via `#app-version`).
- **Update notification:** On load, the app checks the latest GitHub release tag and shows a clickable "New version available" notice (`#update-notice`) when a newer version exists.

### Changed
- **UI refinements:** Rounded corners with a frosted glass effect for both main and settings windows (`backdrop-filter: blur(10px)`), ensuring transparent borders and consistent clipping.

### Fixed
- **Grammar correction shortcut:** `Ctrl+Shift+G` now triggers grammar correction reliably by calling `performGrammarCorrection()` directly (no simulated click), avoiding unintended paste behavior.
- **Opener permissions:** Allowed opening the Releases URL via the Tauri opener capability.

---

## [1.0.0] - 2025-10-11

### 🎉 Major Release: Complete Migration to Tauri

This release marks the complete migration from Electron to Tauri, delivering a high-performance, resource-efficient desktop application built with Rust and modern web technologies.

### Added
- **Tauri-based architecture:** Complete rewrite using Tauri 2.x framework with Rust backend
- **Voice commands system:** Comprehensive voice command processing for all providers
  - Punctuation commands (period, comma, question mark, exclamation mark, etc.)
  - Key press commands (enter, tab, backspace, space, etc.)
  - Key combination commands (copy, paste, save, undo, select all, etc.)
  - Special commands (delete_last_word, grammar_correct, pause_dictation)
  - Regex-based command matching with flexible pattern recognition
  - Voice commands toggle in settings UI to enable/disable functionality
- **Rust-based transcription services:** All provider integrations rewritten in Rust
  - Groq (Whisper-Large-v3-Turbo) with silence-based chunking
  - Deepgram (Nova-3) real-time streaming transcription
  - Cartesia real-time streaming with PCM audio pipeline
  - Google Gemini (2.5 Flash Lite) non-streaming transcription
  - Mistral (Voxtral) audio transcription
  - SambaNova (Whisper-Large-v3) transcription
  - Fireworks Whisper transcription
- **Native keyboard injection:** Windows-native keyboard simulation using `enigo` crate
- **Streaming support:** Real-time transcription for Deepgram and Cartesia providers
- **Settings management:** Persistent settings with JSON storage
- **Global shortcuts:** Native global hotkey registration via Tauri plugins
- **Clipboard management:** Efficient clipboard operations via Tauri plugin
- **Grammar correction:** Multi-provider grammar correction support
  - Groq (GPT-OSS-120B)
  - Google Gemini (2.5 Flash Lite)
  - Mistral (Small)
  - SambaNova (Llama-3.3-70B)
  - Fireworks (GPT-OSS-20B)

### Changed
- **Performance improvements:** ~80% reduction in memory usage compared to Electron version
- **Faster startup:** Near-instant application launch with optimized Rust binary
- **Smaller binary size:** Significantly reduced distributable size with Tauri's compact runtime
- **Improved reliability:** Type-safe Rust backend eliminates entire classes of runtime errors
- **Modern build system:** Cargo-based build with optimized release profile (size and LTO optimizations)
- **Architecture redesign:**
  - Frontend: HTML/CSS/JavaScript for UI and audio capture
  - Backend: Rust for API calls, transcription processing, and system integration
  - IPC: Tauri command system for secure frontend-backend communication
- **Voice command consistency:** Commands now work identically across all providers (streaming and batch)

### Technical Details
- **Backend dependencies:**
  - `tauri 2.8.5` - Core framework
  - `tokio` - Async runtime for concurrent operations
  - `reqwest` - HTTP client with HTTP/2 and TLS support
  - `tokio-tungstenite` - WebSocket client for streaming providers
  - `enigo 0.2` - Native keyboard injection
  - `serde/serde_json` - Serialization/deserialization
  - `regex` - Voice command pattern matching
  - `base64`, `urlencoding` - Data encoding utilities
  - `chrono` - Timestamp handling
- **Build optimizations:**
  - Size optimization (`opt-level = "z"`)
  - Link-time optimization (LTO)
  - Symbol stripping
  - Single codegen unit for maximum optimization
- **Tauri plugins:**
  - `tauri-plugin-global-shortcut` - System-wide keyboard shortcuts
  - `tauri-plugin-clipboard-manager` - Clipboard operations
  - `tauri-plugin-opener` - URL/file opening

### Migration Notes
- The Electron-based version (v0.6.7) is preserved in the `electron/` directory as legacy code
- Settings from the Electron version are not automatically migrated
- All functionality from the Electron version is replicated or improved in the Tauri version
- Build process changed from `npm run build` to `npm run tauri build`
- Development mode changed from `npm start` to `npm run tauri dev`

### Breaking Changes
- Requires Rust toolchain for building from source
- Settings storage location changed (no automatic migration)
- Different build commands and directory structure

---

## Electron Legacy Versions (0.x.x)

The following versions represent the legacy Electron-based implementation, available in the `electron/` directory.

## [0.6.7] - 2025-10-04

### Changed
- Optimized build configuration to include only required dependencies, reducing bundle size and improving startup performance.
- Enabled ASAR packaging for faster file I/O and compressed app code.

### Removed
- Unused dependencies (`express`, `multer`) that were inflating the build size.

## [0.6.6] - 2025-10-04

### Added
- Global shortcut `Ctrl+Shift+V` toggles between compact and expanded window layouts.
- Compact mode preference is now persisted and restored on launch, so the window reopens in the last chosen view.

## [0.6.5] - 2025-09-28

### Added
- Automated version sync (`npm run sync-doc-version`) now reads the latest entry in `CHANGELOG.md` and updates both `package.json` and `README.md` to match.

### Changed
- Settings label now calls the non-clipboard mode "Simulated Typing (SendKeys)" to clarify the behavior.

### Fixed
- Taskbar icon is hidden immediately when the window closes, eliminating orphaned entries.
- Window position persistence now saves during movement only, improving shutdown responsiveness.

## [0.6.4] - 2025-09-28

### Added

### Changed
- Main window launches at the default size but restores your last on-screen position to stay out of the way between sessions.

### Fixed
- Voice command rearraged and removed duplicated commands.

## [0.6.3] - 2025-09-28

### Added
- Deepgram streaming now always loads the provider bundle (`src/shared/providers/deepgram.js`) and forwards the selected language or `multi` plus `endpointing=100` for reliable multilingual transcripts.

### Changed
- Main window is created with `focusable: false`, so clicking Dictate no longer steals focus from the target application while issuing commands.

### Fixed
- Non-ASCII characters are now handled correctly in native injection using the clipboard fallback.

## [0.6.2] - 2025-09-27

### Added
- Smooth compact/expanded window transitions and state animations in `src/renderer/main/styles.css` for a more polished layout switch.
- Optional system tray support (currently commented) that can be re-enabled via `setupTray()` to provide quick access without the main window.

### Changed
- Main window now uses the bundled `assets/icon/icon.ico`, so the Windows taskbar shows the Dictate glyph instead of the default Electron icon.
- Default window styling keeps the dark theme consistent during mode switches by harmonizing body padding and background settings.

## [0.6.1] - 2025-09-27

### Changed
- Windows now wait for their renderers to finish loading before displaying, eliminating the white flash on the main and settings windows.
- Electron windows explicitly use the app's dark theme background color to prevent flicker during startup.

## [0.6.0] - 2025-09-27

### Added
- Real-time Cartesia streaming provider with manual PCM audio pipeline and settings UI selection.

### Changed
- Extracted `settings.js` and `index.js` to remove inline scripts from renderer HTML files, improving maintainability.
- Settings provider API key inputs are now generated dynamically from a single configuration.

### Fixed
- Voice commands (pause dictation, grammar correction, etc.) now also work for streaming providers by routing transcripts through `processAndInject()`.

## [0.5.1] - 2025-09-27

### Added
- Persist main window position and size across launches, restoring to the last location within the active display work area.

### Changed
- Cleanup timer-based saving of main window bounds when the window moves or resizes to reduce disk writes.

### Fixed
- Prevent main window from reopening off-screen by clamping saved bounds to the current monitor.

## [0.5.0] - 2025-09-27

### Added
- Voice command phrases for "select all" (Ctrl+A), grammar correction macro, and pausing dictation (Ctrl+Shift+D).

### Changed
- Voice commands can now be toggled via settings and the parser respects the toggle in both injection flows.
- Grammar correction voice commands trigger select-all before running the shortcut to ensure the provider works on the current text.

### Fixed
- "Delete that" voice command removes the last spoken word reliably and no longer reinserts the command text.

## [0.4.1] - 2025-09-27

### Changed
- Settings window now positions itself relative to available screen space (prefers left, then right, below, above) instead of always shifting left.

## [0.4.0] - 2025-09-26

### Added
- Transcription language selector in the settings window with support for multilingual fallback.

### Changed
- Migrated all provider integrations into `src/shared/providers/` and updated imports across the app.
- Updated Gemini transcription and rewrite endpoints to `gemini-flash-lite-latest`.
- Mistral, SambaNova, Fireworks, and Deepgram providers now consume the saved transcription language when available.

### Fixed
- SambaNova Whisper requests now retry with the correct model casing to avoid `Model not found` responses.

## [0.3.4] - 2025-09-25

### Added
- New provider: SambaNova Whisper-Large-v3 for transcription and Llama-3.3-70B for rewrite actions.
- New provider: Fireworks Whisper transcription and GPT-OSS-20B rewrite helper.
- Mistral now exposes a text rewrite helper alongside transcription support.
- Settings UI now supports SambaNova and Fireworks API keys for both transcription and grammar rewrite providers.

### Changed
- Grammar rewrite prompts are now managed in `src/main/main.js`, making provider helpers prompt-agnostic.
- README updated to reflect SambaNova support across transcription and grammar correction providers.
- Settings grammar provider dropdown includes Groq, Gemini, Mistral, SambaNova, and Fireworks.
- Settings UI refinements: toggle switch for "Text formatted", updated labels/icons.

### Fixed
- N/A

## [0.3.3] - 2025-09-23

### Added
- Global shortcut: Ctrl+Shift+G to trigger Grammar Correction (sparkle) on the current selection.

### Changed
- Recording shortcut changed to Ctrl+Shift+D.
- Debug/DevTools toggle moved to Ctrl+Shift+L.
- README updated to reflect new shortcuts and version bumped to 0.3.3.

### Fixed
- N/A

## [0.3.2] - 2025-09-23

### Added
- Grammar correction action with abort-on-reclick (pulsing UI) for selected text.
- Groq-based grammar correction via Chat Completions (model: openai/gpt-oss-120b).
- Settings: new Grammar correction provider dropdown (Groq or Gemini).

### Changed
- Default grammar correction provider is now Groq; dropdown lists Groq first.
- README updated to document grammar correction and defaults; version bumped to 0.3.2.

### Fixed
- Minor UI polish for sparkle button active/idle states.

## [0.3.1] - 2025-09-23

### Added
- New provider: Mistral (non‑streaming) via the Audio Transcriptions API (multipart/form-data).
- Settings UI: Added Mistral to provider dropdown and a Mistral API Key field.

### Changed
- Main process now routes non‑streaming segments to Groq, Gemini, or Mistral based on selected provider, reusing the same formatting and command parsing path.

### Fixed
- N/A

## [0.3.0] - 2025-09-23

### Added
- New provider: Google Gemini Flash (non‑streaming) with inline audio transcription via the Generative Language API.
- Settings UI: Added Gemini to provider dropdown and a Gemini API Key field.

### Changed
- Main process now routes non‑streaming segments to Groq or Gemini based on selected provider, reusing formatting and unified command parsing.
- The existing "Text formatted" setting applies to Gemini as well (preserve vs. normalize in-app).

### Fixed
- N/A

## [0.2.2] - 2025-09-23

### Added
- Unified command parsing for Groq and Deepgram via a reusable `processAndInject()` in `src/main/main.js` that uses `src/shared/voice-commands.js` as the single source of truth.

### Changed
- Settings: single "Text formatted" option now controls both providers:
  - Groq: when unchecked, we normalize text (lowercase + remove punctuation); when checked, preserve as returned.
  - Deepgram: sets `smart_format` to match the setting (true when checked, false when unchecked).
- Settings UI: label text updated to "Text formatted".

### Fixed
- N/A

## [0.2.1] - 2025-09-23

### Added
- Settings: "Preserve original formatting (Groq only)" checkbox. When disabled, Groq transcriptions are lowercased and punctuation is removed before insertion.

### Changed
- None.

### Fixed
- None.

## [0.2.0] - 2025-09-23

### Added
- Groq (Whisper) silence-based chunking in the renderer:
  - Continuous capture with simple RMS level detector.
  - Segments are emitted on ~1s silence and sent as WAV to Groq.
  - Safety cut for long utterances and a minimal segment filter.
- Debug toggle via `Ctrl+Shift+D`:
  - Opens/closes DevTools and toggles verbose logs in both renderer and main.

### Changed
- Tuned thresholds to improve reliability across environments.
- Improved audio cue loading with base64/file URL fallback and preloading.

### Fixed
- Ensured audio processing node is connected so frames are processed in Groq mode.
- Added detailed logs to diagnose networking/API issues with Groq.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning (SemVer): MAJOR.MINOR.PATCH

## [0.1.0] - 2025-09-23

### Added
- Settings: Insertion Mode dropdown to choose between Clipboard (paste) and Native (SendKeys).
- Settings: Provider-specific API keys with eye-toggle inside the input to show/hide the key.
- Deepgram: Streaming transcription path with nova-3 defaults and configurable encoding based on MediaRecorder support.
- Voice Commands: Centralized `src/shared/voice-commands.js` with punctuation and key commands, plus "delete that" to remove last word.
- Packaging: Fallback loading for audio cues (beep/clack) via base64 or file URL.
- Asset discovery in packaged apps checks both `resources/assets/...` (extraResources) and `resources/app/assets/...` (bundled) paths.

### Changed
- Centralized Deepgram WebSocket URL builder and defaults in `src/shared/deepgram.js`.
- `insert-text` handler: parses and executes commands, inserts remaining text using the chosen insertion mode, and ensures trailing space between segments.
- Settings UI shows only the API key field relevant to the selected provider for a cleaner UI.

### Fixed
- Missing spaces between Deepgram segments while retaining command handling.
- Audio cue reliability after packaging by adding base64/file URL fallback and robust asset path resolution.
- Windows icon path for electron-builder (uses `assets/icon/`), avoiding default icon.
