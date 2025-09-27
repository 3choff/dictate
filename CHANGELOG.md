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
