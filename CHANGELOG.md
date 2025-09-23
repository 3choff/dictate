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
