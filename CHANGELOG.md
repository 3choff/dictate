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

[0.1.0]: https://github.com/3choff/dictate/releases/tag/v0.1.0
