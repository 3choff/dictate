# Dictate

![Dictate Demo](https://github.com/3choff/dictate/blob/main/assets/demo/demo.gif?raw=true)

Dictate is a high-performance desktop dictation application for Windows built with Tauri and Rust, inspired by the familiar UI of Windows Voice Typing. It delivers powerful speech-to-text capabilities with minimal resource usage, allowing users to record audio, transcribe it in real-time, and seamlessly insert the transcription into any active application. With features like global hotkeys, audio cues, and voice commands, Dictate streamlines your workflow and boosts productivity.

If Dictate improves your workflow, please consider supporting ongoing AI memberships and inference costs via 
[**Ko-fi**](https://ko-fi.com/3choff)           [![Support via Ko-fi](./assets/ko-fi/kofi_symbol.svg)](https://ko-fi.com/3choff)

**Version:** 1.12.0
**All changes are documented in the `CHANGELOG.md` file.**

> **Note:** The legacy Electron-based version (v0.6.7) is available in the `electron-legacy` branch.

## Features

*   **Desktop Dictation:** Record your voice and have it transcribed into text.
*   **Seamless Text Insertion:** Automatically pastes or types the transcribed text into your active application.
*   **Standalone Windows Executable:** Packaged as a portable `.exe` for easy distribution and use.
*   **Interactive Settings:** Configure API keys, transcription services (Deepgram, Cartesia, Groq, Gemini, Mistral, SambaNova, Fireworks), text rewrite provider and mode (Groq, Gemini, Mistral, SambaNova, Fireworks), transcription language, and text insertion modes through a dedicated settings window.
*   **Help & Support:** Quick access to the project's GitHub page via a help button.
*   **Global Keyboard Shortcuts:** System-wide shortcuts for recording, text rewrite, compact mode, and more (see [Keyboard Shortcuts](#keyboard-shortcuts) section).
*   **Text Rewrite:** Select any text in any app and click the sparkle button (or press `Ctrl+Shift+R`) to rewrite it using your chosen mode and AI provider. Choose from Grammar Correction, Professional Tone, Polite Tone, Casual Tone, or Structured & Organized. **Fully customizable prompts:** Edit the instructions for any mode directly in settings to tailor the AI's behavior to your exact needs.
*   **Audio Cues:** Audible "beep" on starting recording and "clack" on stopping recording for clear feedback.
*   **Push‑to‑Talk (Batch Providers):** Optional mode that records only while you hold the recording shortcut, then transcribes immediately on release. Enable it in Settings → Customize. Supported with Groq, Gemini, Mistral, SambaNova, and Fireworks. When a streaming provider (Deepgram, Cartesia) is selected, Push‑to‑Talk is disabled and a brief warning explains it’s only available with batch providers.
*   **Multiple Transcription Services:**
    *   **Groq:** ML-based Voice Activity Detection (VAD) with intelligent speech segmentation.
    *   **Deepgram:** Real-time streaming transcription for lower latency.
    *   **Cartesia:** Real-time streaming transcription using a dedicated PCM pipeline.
    *   **Gemini:** ML-based VAD with intelligent speech segmentation.
    *   **Mistral:** ML-based VAD with intelligent speech segmentation.
    *   **SambaNova:** ML-based VAD with intelligent speech segmentation.
    *   **Fireworks:** ML-based VAD with intelligent speech segmentation.
*   **Intelligent Speech Segmentation:** Uses Silero VAD (Voice Activity Detection) ML model for accurate speech detection:
    *   Automatically trims silence before and after speech
    *   Ignores keyboard/mouse noise and background sounds
    *   Configurable silence threshold (400ms default)
    *   No false positives from non-speech audio
    *   Complete utterances preserved with smart buffering
*   **Multilingual Understanding:** Pick a default transcription language in settings. Providers that accept language hints receive it automatically; leaving the selector on `Multilingual` falls back to each provider's auto-detect mode.
    * Deepgram streams with `language=multi`.
    * Groq Whisper (whisper-large-v3-turbo) auto-detects language.
    * Gemini Flash Lite handles multilingual audio.
    * Mistral Voxtral receives the selected language when provided.
    * SambaNova Whisper receives the selected language when provided.
*   **Word Correction:** Automatically correct frequent mis-transcriptions (e.g., "chat gpt" -> "ChatGPT") using a customizable dictionary. Supports fuzzy matching (configurable threshold) to catch slight variations in spelling or spacing. Manage your custom word list easily in Settings.
*   **Text Formatting Control:** Single "Text formatted" setting controls output:
    * Non‑streaming providers (Groq, Gemini, Mistral): when unchecked, the app normalizes transcript (lowercase + removes punctuation). When checked, transcript is preserved.
    * Streaming provider (Deepgram): toggles the `smart_format` request parameter to match the setting.
*   **Flexible Text Insertion:** Choose between native Windows SendKeys or clipboard-based insertion for compatibility.
*   **Voice Commands:** Execute rich text manipulation actions (e.g., "press enter", "backspace", "delete that", "select all", "press rewrite") and system shortcuts entirely through voice, with an in-app toggle to enable or disable them. Commands now apply consistently to both streaming and non-streaming providers.
*   **System Tray Integration:** The app runs in the system tray with quick access to Show/Hide, Settings, and Quit.
*   **Close to Tray:** Option to minimize to system tray instead of exiting when closing the window. Configurable in Settings → Interface.
*   **Start Hidden:** Option to launch the app hidden to system tray without showing the main window.
*   **Launch on Startup:** Automatically start Dictate when you log in to Windows. Configurable in Settings → Interface.
*   **Multi-Language Interface:** Full UI localization supporting 10 languages: English, Italian, Spanish, French, German, Dutch, Portuguese, Chinese, Japanese, and Russian. Change the interface language in Settings → Interface.

## Installation

To set up and run Dictate:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/3choff/dictate.git
    cd dictate
    ```
2.  **Install Rust toolchain (if not already installed):**
    ```bash
    # Visit https://rustup.rs/ or use:
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    ```
3.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```
4.  **Build the application (for a portable Windows executable):**
    ```bash
    npm run tauri build
    ```
    The installer and portable executable will be generated in the `src-tauri/target/release/bundle` folder.

## Usage

### Running the Application

*   **Development Mode:** To run the app in development mode:
    ```bash
    npm run tauri dev
    ```
    Or use the Tauri CLI directly:
    ```bash
    cd src-tauri
    cargo tauri dev
    ```
*   **Packaged Application:** After building, navigate to the `src-tauri/target/release/bundle/nsis` folder and run the installer, or use the portable executable in `src-tauri/target/release`.

### Window Views

Right-click anywhere on the main window to quickly toggle between the compact and expanded layouts.

### Recording and Transcribing

1.  **Launch Dictate.**
2.  **Start Recording:** Press `Ctrl+Shift+D` to start recording (see [Keyboard Shortcuts](#keyboard-shortcuts) for all available shortcuts). You will hear a "beep" sound.
3.  **Speak:** Dictate your text.
4.  **Stop Recording:** Press `Ctrl+Shift+D` again to stop recording or say "stop listening". You will hear a "clack" sound.
5.  **Text Insertion:** The transcribed text will automatically be pasted into your currently active application.
   * Groq, Mistral, SambaNova, Fireworks, Gemini: Speak, pause ~1s to emit a segment; text is inserted per segment.
   * Deepgram and Cartesia: Inserts finalized phrases as they arrive in streaming mode.

#### Push‑to‑Talk Mode

If you enable Push‑to‑Talk in Settings → Customize, hold the recording shortcut (`Ctrl+Shift+D` by default) to record; release to stop and transcribe instantly. Push‑to‑Talk is supported with batch providers (Groq, Gemini, Mistral, SambaNova, Fireworks). When a streaming provider (Deepgram or Cartesia) is selected, the app prevents enabling Push‑to‑Talk and shows a short in‑app notice.

### Settings

Click the gear icon in the Dictate window to open the settings. Here you can:
*   Enter your API keys for Groq, Deepgram, Cartesia, Gemini, Mistral, SambaNova, and Fireworks.
*   Select your preferred transcription service and transcription language (or leave `Multilingual`).
*   Configure text rewrite settings:
    *   Choose rewrite mode: Grammar Correction, Professional Tone, Polite Tone, Casual Tone, or Structured & Organized
    *   Select AI provider: Groq GPT-OSS-120B, Gemini 2.5 Flash Lite, Mistral Small, Llama-3.3-70B, or Fireworks GPT-OSS-20B (Default: Groq)
*   Choose your text insertion mode (Simulated Typing via SendKeys or Clipboard paste).
*   Toggle "Text formatted" to control normalized vs. formatted output for both providers (Groq normalization, Deepgram `smart_format`).

### Voice Commands

Dictate supports several voice commands for hands-free text manipulation. The full list of available commands is defined in `src-tauri/src/voice_commands.rs` and applies consistently across all providers (streaming and batch). Here are a few examples:

*   **Punctuation:** "period" (.), "comma" (,), "question mark" (?)
*   **Key Presses:** "press enter", "backspace", "press space", "press tab"
*   **Control Combinations:** "press control plus c" (Ctrl+C), "press control plus v" (Ctrl+V)
*   **Text Manipulation:** "delete that" (removes the most recent word), "select all" (Ctrl+A)
*   **Text Rewrite:** "press rewrite" (selects all text and runs the text rewrite shortcut with current mode)
*   **Dictation Controls:** "pause voice typing", "stop dictation", "pause voice mode", etc. (sends Ctrl+Shift+D to pause voice typing)

### Keyboard Shortcuts

Dictate provides global keyboard shortcuts that work from anywhere on your system. **All shortcuts are fully customizable** - you can change them to your preferred key combinations in the Settings window under the "Shortcuts" tab:

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl+Shift+D` | **Toggle Recording** | Start or stop dictation. You'll hear a "beep" when recording starts and a "clack" when it stops. |
| `Ctrl+Shift+R` | **Text Rewrite** | Rewrite selected text using your chosen mode (Grammar Correction, Professional, Polite, Casual, or Structured) and AI provider. Click the sparkle button or use this shortcut, then select text in any application. |
| `Ctrl+Shift+V` | **Toggle Compact Mode** | Switch between compact and expanded window layouts. This preference is saved and restored on app launch. |
| `Ctrl+Shift+S` | **Toggle Settings** | Open or close the settings window. |
| `Ctrl+Shift+L` | **Toggle DevTools** | Open or close the developer console for debugging (development feature). |
| `Ctrl+Shift+X` | **Exit Application** | Close Dictate gracefully. |

**Note:** All shortcuts use `Ctrl+Shift` to avoid conflicts with common application shortcuts. You can customize any of these in Settings → Shortcuts.

## Development Notes

*   **Technology Stack:**
    *   **Backend:** Rust with Tauri 2.x framework
    *   **Frontend:** HTML, CSS, vanilla JavaScript
    *   **Audio Processing:** Web Audio API with streaming support
    *   **Keyboard Injection:** Native Windows API via `enigo` crate
*   **Architecture:**
    *   Rust backend handles all API calls, transcription processing, and voice command execution
    *   Frontend provides UI and audio capture
    *   IPC communication via Tauri's command system
*   **Performance:** 
    *   Tauri reduces memory usage by ~80% compared to the Electron version
    *   Faster startup times and lower resource usage
    *   Non-blocking VAD processing with async Rust (tokio)
    *   <50ms VAD latency per frame
*   **Legacy Version:** The Electron-based version (v0.6.7) is available in the `electron-legacy` branch.

## Roadmap

### Upcoming Features

- [x] **Theme Toggle**: Add dark/light theme switching
- [x] **System Tray Integration**: Launch on system startup and minimize to tray for always-available dictation access
- [x] **Word Correction**: Enhanced mis-transcribed word correction with custom dictionary and fuzzy matching
- [ ] **Cross-Platform Support**: Native support for Linux and macOS with platform-specific optimizations

---

## Acknowledgements

This project incorporates the Silero VAD (Voice Activity Detection) implementation from the [Handy](https://github.com/cjpais/Handy) project by cjpais. The VAD module provides intelligent speech segmentation using machine learning, significantly improving transcription accuracy by filtering out non-speech audio and properly detecting speech boundaries.

The VAD integration includes:
- Silero VAD model for ML-based speech detection
- SmoothedVad wrapper with onset detection, hangover, and prefill buffering
- Async session management for non-blocking audio processing

Thank you to the Handy project for the excellent VAD implementation!

## License

This project is licensed under the Apache License 2.0.
