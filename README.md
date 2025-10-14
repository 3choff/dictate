# Dictate

![Dictate Demo](https://github.com/3choff/dictate/blob/main/assets/demo/demo.gif?raw=true)

Dictate is a high-performance desktop dictation application for Windows built with Tauri and Rust, inspired by the familiar UI of Windows Voice Typing. It delivers powerful speech-to-text capabilities with minimal resource usage, allowing users to record audio, transcribe it in real-time, and seamlessly insert the transcription into any active application. With features like global hotkeys, audio cues, and voice commands, Dictate streamlines your workflow and boosts productivity.

**Version:** 1.2.2
**All changes are documented in the `CHANGELOG.md` file.**

> **Note:** The legacy Electron-based version (v0.6.7) is available in the `electron-legacy` branch.

## Features

*   **Desktop Dictation:** Record your voice and have it transcribed into text.
*   **Seamless Text Insertion:** Automatically pastes or types the transcribed text into your active application.
*   **Standalone Windows Executable:** Packaged as a portable `.exe` for easy distribution and use.
*   **Interactive Settings:** Configure API keys, transcription services (Deepgram, Cartesia, Groq, Gemini, Mistral, SambaNova, Fireworks), grammar correction provider (Groq, Gemini, Mistral, SambaNova, Fireworks), transcription language, and text insertion modes through a dedicated settings window.
*   **Help & Support:** Quick access to the project's GitHub page via a help button.
*   **Global Keyboard Shortcuts:** System-wide shortcuts for recording, grammar correction, compact mode, and more (see [Keyboard Shortcuts](#keyboard-shortcuts) section).
*   **Grammar Correction:** Select any text in any app and click the sparkle button (or press `Ctrl+Shift+G`) to correct grammar with your chosen provider (default: Groq). Click again while pulsing to abort.
*   **Audio Cues:** Audible "beep" on starting recording and "clack" on stopping recording for clear feedback.
*   **Multiple Transcription Services:**
    *   **Groq:** Silence-based chunking with continuous capture; sends WAV segments on ~1s silence.
    *   **Deepgram:** Real-time streaming transcription for lower latency.
    *   **Cartesia:** Real-time streaming transcription using a dedicated PCM pipeline.
    *   **Gemini:** Non‑streaming transcription via Google Gemini API using inline audio.
    *   **Mistral:** Non‑streaming transcription via Mistral Audio Transcriptions API (multipart/form-data).
    *   **SambaNova:** Non‑streaming transcription via SambaNova Whisper-Large-v3 endpoint.
    *   **Fireworks:** Non‑streaming transcription via Fireworks Whisper endpoint.
*   **Multilingual Understanding:** Pick a default transcription language in settings. Providers that accept language hints receive it automatically; leaving the selector on `Multilingual` falls back to each provider's auto-detect mode.
    * Deepgram streams with `language=multi`.
    * Groq Whisper (whisper-large-v3-turbo) auto-detects language.
    * Gemini Flash Lite handles multilingual audio.
    * Mistral Voxtral receives the selected language when provided.
    * SambaNova Whisper receives the selected language when provided.
*   **Text Formatting Control:** Single "Text formatted" setting controls output:
    * Non‑streaming providers (Groq, Gemini, Mistral): when unchecked, the app normalizes transcript (lowercase + removes punctuation). When checked, transcript is preserved.
    * Streaming provider (Deepgram): toggles the `smart_format` request parameter to match the setting.
*   **Flexible Text Insertion:** Choose between native Windows SendKeys or clipboard-based insertion for compatibility.
*   **Voice Commands:** Execute rich text manipulation actions (e.g., "press enter", "backspace", "delete that", "select all", "correct grammar") and system shortcuts entirely through voice, with an in-app toggle to enable or disable them. Commands now apply consistently to both streaming and non-streaming providers.

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
    The installer and portable executable will be generated in the `tauri-src/target/release/bundle` folder.

## Usage

### Running the Application

*   **Development Mode:** To run the app in development mode:
    ```bash
    npm run tauri dev
    ```
    Or use the Tauri CLI directly:
    ```bash
    cd tauri-src
    cargo tauri dev
    ```
*   **Packaged Application:** After building, navigate to the `tauri-src/target/release/bundle/nsis` folder and run the installer, or use the portable executable in `tauri-src/target/release`.

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

### Settings

Click the gear icon in the Dictate window to open the settings. Here you can:
*   Enter your API keys for Groq, Deepgram, Cartesia, Gemini, Mistral, SambaNova, and Fireworks.
*   Select your preferred transcription service and transcription language (or leave `Multilingual`).
*   Select grammar correction provider (Groq GPT-OSS-120B, Gemini 2.5 Flash, Mistral Small, Llama-3.3-70B, or Fireworks GPT-OSS-20B). Default is Groq.
*   Choose your text insertion mode (Simulated Typing via SendKeys or Clipboard paste).
*   Toggle "Text formatted" to control normalized vs. formatted output for both providers (Groq normalization, Deepgram `smart_format`).

### Voice Commands

Dictate supports several voice commands for hands-free text manipulation. The full list of available commands is defined in `tauri-src/src/voice_commands.rs` and applies consistently across all providers (streaming and batch). Here are a few examples:

*   **Punctuation:** "period" (.), "comma" (,), "question mark" (?)
*   **Key Presses:** "press enter", "backspace", "press space", "press tab"
*   **Control Combinations:** "press control plus c" (Ctrl+C), "press control plus v" (Ctrl+V)
*   **Text Manipulation:** "delete that" (removes the most recent word), "select all" (Ctrl+A)
*   **Grammar:** "correct grammar" / "correct the grammar" (selects all text and runs the grammar shortcut)
*   **Dictation Controls:** "pause voice typing", "stop dictation", "pause voice mode", etc. (sends Ctrl+Shift+D to pause voice typing)

### Keyboard Shortcuts

Dictate provides global keyboard shortcuts that work from anywhere on your system:

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl+Shift+D` | **Toggle Recording** | Start or stop dictation. You'll hear a "beep" when recording starts and a "clack" when it stops. |
| `Ctrl+Shift+G` | **Grammar Correction** | Correct grammar on selected text using your chosen AI provider. Click the sparkle button or use this shortcut, then select text in any application. |
| `Ctrl+Shift+V` | **Toggle Compact Mode** | Switch between compact and expanded window layouts. This preference is saved and restored on app launch. |
| `Ctrl+Shift+S` | **Toggle Settings** | Open or close the settings window. |
| `Ctrl+Shift+L` | **Toggle DevTools** | Open or close the developer console for debugging (development feature). |
| `Ctrl+Shift+X` | **Exit Application** | Close Dictate gracefully. |

**Note:** All shortcuts use `Ctrl+Shift` to avoid conflicts with common application shortcuts.

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
*   **Performance:** Tauri reduces memory usage by ~80% compared to the Electron version while providing faster startup times
*   **Legacy Version:** The Electron-based version (v0.6.7) is available in the `electron/` directory for reference

## License

This project is licensed under the Apache License 2.0.
